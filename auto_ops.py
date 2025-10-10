#!/usr/bin/env python3
"""
Auto deploy + verify helper for WEBJOBS_NAVIGATOR_PHP.

Features
- Bumps footer app version (patch) in index.php
- Bumps asset cache busters (?v=) for style.css and app.js
- Uploads key files via plain FTP (ftplib)
- Verifies the site and status endpoint after upload

Usage
  python3 auto_ops.py            # bump + upload + verify
  python3 auto_ops.py --dry-run  # show planned changes only
  python3 auto_ops.py --bump-only
  python3 auto_ops.py --upload-only
  python3 auto_ops.py --verify-only

Environment overrides
  FTP_HOST, FTP_USER, FTP_PASS, FTP_PORT, FTP_REMOTE, VERIFY_URL

Defaults (from prior scripts)
  host=195.179.238.91 user=u343523827 pass='3s>C]t32ZdSJ!a.'
  remote_dir=jobs_navigator verify=https://www.mateusribeiro.com/jobs_navigator/
"""

from __future__ import annotations
import argparse
import os
import re
import sys
import ftplib
import urllib.request
from dataclasses import dataclass

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(ROOT, 'index.php')


@dataclass
class VersionChange:
    old_app: str
    new_app: str
    old_cache: int
    new_cache: int


def bump_versions(dry: bool = False) -> VersionChange:
    with open(INDEX, 'r', encoding='utf-8') as f:
        content = f.read()

    # Bump footer version v X.Y.Z -> X.Y.(Z+1)
    ver_re = re.compile(r'(class="version">\s*v\s*)(\d+)\.(\d+)\.(\d+)(\s*</div>)')
    m = ver_re.search(content)
    if not m:
        raise RuntimeError('Could not find footer version in index.php')
    major, minor, patch = int(m.group(2)), int(m.group(3)), int(m.group(4))
    new_patch = patch + 1
    old_app = f"{major}.{minor}.{patch}"
    new_app = f"{major}.{minor}.{new_patch}"
    # Use group names to avoid '\1' + digit ambiguity (e.g., becomes \12)
    content = ver_re.sub(lambda m: f"{m.group(1)}{new_app}{m.group(5)}", content, count=1)

    # Bump cache busters for assets to max(existing)+1
    cache_re = re.compile(r'(assets/(?:style\.css|app\.js)\?v=)(\d+)')
    nums = [int(n2) for _, n2 in cache_re.findall(content)]
    old_cache = max(nums) if nums else 0
    new_cache = old_cache + 1
    content = cache_re.sub(rf"\g<1>{new_cache}", content)

    if not dry:
        with open(INDEX, 'w', encoding='utf-8') as f:
            f.write(content)

    return VersionChange(old_app=old_app, new_app=new_app, old_cache=old_cache, new_cache=new_cache)


def _ftp_connect() -> ftplib.FTP:
    host = os.getenv('FTP_HOST')
    user = os.getenv('FTP_USER')
    passwd = os.getenv('FTP_PASS')
    if not host or not user or not passwd:
        raise RuntimeError('Set FTP_HOST, FTP_USER, FTP_PASS environment variables')
    port = int(os.getenv('FTP_PORT', '21'))
    ftp = ftplib.FTP()
    ftp.connect(host, port, timeout=30)
    ftp.login(user, passwd)
    ftp.set_pasv(True)
    return ftp


def _ftp_mkdirs(ftp: ftplib.FTP, path: str) -> None:
    parts = [p for p in path.split('/') if p]
    acc = ''
    for p in parts:
        acc = f"{acc}/{p}" if acc else p
        try:
            ftp.mkd(acc)
        except Exception:
            pass


def upload_files(dry: bool = False) -> None:
    """Upload entire project tree except the Dev/ folder.

    All files under WEBJOBS_NAVIGATOR_PHP are uploaded preserving the
    directory structure. Any directory named 'Dev' at any level is skipped.
    """
    remote_base = os.getenv('FTP_REMOTE', 'jobs_navigator')

    all_files: list[str] = []
    for root, dirs, files in os.walk(ROOT):
        # Skip any Dev directory
        dirs[:] = [d for d in dirs if d != 'Dev']
        for name in files:
            rel = os.path.relpath(os.path.join(root, name), ROOT)
            rel = rel.replace(os.sep, '/')
            # Skip nothing else per request (include dotfiles and vendor)
            all_files.append(rel)

    if dry:
        print(f"[dry-run] Would upload {len(all_files)} files:")
        for f in all_files:
            print(' -', f)
        return

    ftp = _ftp_connect()
    try:
        ftp.cwd(remote_base)
    except Exception:
        _ftp_mkdirs(ftp, remote_base)
        ftp.cwd(remote_base)

    for rel in all_files:
        local_path = os.path.join(ROOT, rel)
        # ensure remote subdirs
        subdir = os.path.dirname(rel)
        if subdir:
            try:
                _ftp_mkdirs(ftp, subdir)
            except Exception:
                pass
        with open(local_path, 'rb') as fh:
            print('[upload]', rel)
            ftp.storbinary(f'STOR {rel}', fh)

    ftp.quit()


def verify() -> int:
    base = os.getenv('VERIFY_URL', 'https://www.mateusribeiro.com/jobs_navigator/')
    urls = [
        base,
        base.rstrip('/') + '/api.php?action=status',
    ]
    ok = True
    for u in urls:
        try:
            with urllib.request.urlopen(u, timeout=15) as r:
                code = r.getcode()
                print('[verify]', u, '->', code)
                if code != 200:
                    ok = False
                # For index check, show small snippet
                if u == base:
                    body = r.read(2000).decode('utf-8', errors='ignore')
                    print('[verify] snippet:', body.splitlines()[0:3])
        except Exception as e:
            ok = False
            print('[verify] FAIL', u, '->', e)
    return 0 if ok else 2


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--bump-only', action='store_true')
    ap.add_argument('--upload-only', action='store_true')
    ap.add_argument('--verify-only', action='store_true')
    args = ap.parse_args(argv)

    if args.verify_only:
        return verify()

    if args.bump_only:
        ch = bump_versions(dry=args.dry_run)
        print(f"[bump] app: {ch.old_app} -> {ch.new_app}; cache: {ch.old_cache} -> {ch.new_cache}")
        return 0

    if args.upload_only:
        upload_files(dry=args.dry_run)
        return 0

    # default: bump + upload + verify
    ch = bump_versions(dry=args.dry_run)
    print(f"[bump] app: {ch.old_app} -> {ch.new_app}; cache: {ch.old_cache} -> {ch.new_cache}")
    upload_files(dry=args.dry_run)
    return verify()


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
