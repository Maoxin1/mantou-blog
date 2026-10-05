#!/usr/bin/env python3
"""Pass the deployed source identity across chained workflows without secrets.

The downstream workflow_run.head_sha is the deploy workflow's revision, which
need not be the validated source that it built. Use that run's artifact instead.
"""
import argparse
import json
import os
from pathlib import Path
import re


def validate(metadata):
    if not isinstance(metadata, dict) or set(metadata) != {
        'commit_sha', 'deploy_branch', 'run_id', 'run_attempt',
    }:
        raise ValueError('Invalid deployment metadata fields')
    if not isinstance(metadata['commit_sha'], str) or not re.fullmatch(r'[0-9a-f]{40}', metadata['commit_sha']):
        raise ValueError('Expected a full lowercase commit SHA')
    if metadata['deploy_branch'] not in ('main', 'manual-preview'):
        raise ValueError('Unexpected deployment branch')
    for field in ('run_id', 'run_attempt'):
        if not isinstance(metadata[field], str) or not re.fullmatch(r'[1-9][0-9]*', metadata[field]):
            raise ValueError(f'Invalid {field}')
    return metadata


def expected_version(metadata, run_id, run_attempt):
    validate(metadata)
    if metadata['deploy_branch'] != 'main':
        raise ValueError('A preview deployment cannot identify the production version')
    if metadata['run_id'] != run_id or metadata['run_attempt'] != run_attempt:
        raise ValueError('Metadata does not belong to the triggering deployment attempt')
    # Validation above forbids newlines and unsafe environment-file content.
    return 'SMOKE_EXPECTED_VERSION=' + json.dumps(metadata, separators=(',', ':')) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('write', 'expected'))
    parser.add_argument('path', type=Path)
    args = parser.parse_args()
    if args.command == 'write':
        metadata = validate({
            'commit_sha': os.environ['DEPLOY_COMMIT'],
            'deploy_branch': os.environ['DEPLOY_BRANCH'],
            'run_id': os.environ['GITHUB_RUN_ID'],
            'run_attempt': os.environ['GITHUB_RUN_ATTEMPT'],
        })
        args.path.write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    else:
        metadata = json.loads(args.path.read_text(encoding='utf-8'))
        output = expected_version(metadata, os.environ['DEPLOY_RUN_ID'], os.environ['DEPLOY_RUN_ATTEMPT'])
        with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as environment:
            environment.write(output)
        print(f"Expect production source {metadata['commit_sha']} from deployment {metadata['run_id']}/{metadata['run_attempt']}")


if __name__ == '__main__':
    main()
