#!/usr/bin/env python3
"""
Generate a minimal valid WebM demo video from a Playwright test recording.
Extracts just the first VP8 keyframe to produce a ~1KB self-contained video
that browsers can load and play without any external dependencies.

Run this script whenever you need to regenerate public/demo.webm.
The source is a Playwright browser recording (valid VP8 WebM).
"""
import struct
import os
import glob

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT = os.path.join(PROJECT_ROOT, 'public', 'demo.webm')


def vint_encode(n):
    """Encode a number as an EBML variable-length integer."""
    if n <= 0x7e:
        return bytes([n | 0x80])
    elif n <= 0x3ffe:
        return struct.pack('>H', n | 0x4000)
    elif n <= 0x1ffffe:
        b = struct.pack('>I', n | 0x200000)
        return b[1:]
    else:
        return struct.pack('>Q', n | 0x0100000000000000)[1:]


def ebml_elem(id_bytes, payload):
    """Build an EBML element: ID + vint(size) + payload."""
    return id_bytes + vint_encode(len(payload)) + payload


def find_source_webm():
    """Find the most recent Playwright test recording WebM."""
    patterns = [
        os.path.join(PROJECT_ROOT, 'test-results', '**', '*.webm'),
    ]
    candidates = []
    for pattern in patterns:
        candidates.extend(glob.glob(pattern, recursive=True))

    if not candidates:
        return None

    # Pick the largest file (most likely to be a real recording)
    return max(candidates, key=os.path.getsize)


def extract_first_frame(source_path):
    """
    Extract a trimmed WebM containing only the first VP8 keyframe.
    Returns the bytes of the minimal WebM.
    """
    with open(source_path, 'rb') as f:
        data = f.read()

    # Find first Cluster (EBML ID: 1F 43 B6 75)
    cluster_id = bytes([0x1f, 0x43, 0xb6, 0x75])
    cluster_pos = data.find(cluster_id)
    if cluster_pos == -1:
        raise ValueError('No Cluster found in WebM file')

    # Parse cluster: skip ID (4) + size vint (variable)
    pos = cluster_pos + 4

    # Read cluster size vint (just to advance past it)
    b = data[pos]
    if b & 0x80:
        pos += 1
    elif b & 0x40:
        pos += 2
    elif b & 0x20:
        pos += 3
    else:
        pos += 4

    # Find Timecode element (E7) and SimpleBlock (A3) within cluster
    timecode_bytes = b''
    simple_block_data = None

    cluster_end = min(cluster_pos + 300000, len(data))

    while pos < cluster_end:
        elem_id = data[pos]
        if elem_id == 0xe7:  # Timecode
            pos += 1
            sz_b = data[pos]
            if sz_b & 0x80:
                sz = sz_b & 0x7f
                pos += 1
            elif sz_b & 0x40:
                sz = ((sz_b & 0x3f) << 8) | data[pos + 1]
                pos += 2
            else:
                sz = 1
                pos += 1
            timecode_val = int.from_bytes(data[pos:pos + sz], 'big')
            timecode_bytes = ebml_elem(b'\xe7', timecode_val.to_bytes(max(1, (timecode_val.bit_length() + 7) // 8), 'big') if timecode_val else b'\x00')
            pos += sz

        elif elem_id == 0xa3:  # SimpleBlock
            pos += 1
            # Read vint size
            sb = data[pos]
            if sb & 0x80:
                sz = sb & 0x7f
                pos += 1
            elif sb & 0x40:
                sz = ((sb & 0x3f) << 8) | data[pos + 1]
                pos += 2
            elif sb & 0x20:
                sz = ((sb & 0x1f) << 16) | (data[pos + 1] << 8) | data[pos + 2]
                pos += 3
            else:
                sz = ((sb & 0x0f) << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]
                pos += 4
            simple_block_data = data[pos:pos + sz]
            break  # Only need the first SimpleBlock
        else:
            # Unknown element — skip using vint size
            pos += 1
            if pos >= len(data):
                break
            sb = data[pos]
            if sb & 0x80:
                sz = sb & 0x7f
                pos += 1
            elif sb & 0x40:
                sz = ((sb & 0x3f) << 8) | data[pos + 1]
                pos += 2
            elif sb & 0x20:
                sz = ((sb & 0x1f) << 16) | (data[pos + 1] << 8) | data[pos + 2]
                pos += 3
            else:
                sz = 64  # safe skip for unknown elements
                pos += 1
            pos += sz

    if simple_block_data is None:
        raise ValueError('No SimpleBlock found in first Cluster')

    # Build the trimmed WebM
    # Header = everything from start to first cluster
    header = data[0:cluster_pos]

    # New cluster with just: Timecode + one SimpleBlock
    cluster_content = timecode_bytes + ebml_elem(b'\xa3', simple_block_data)
    cluster = ebml_elem(b'\x1f\x43\xb6\x75', cluster_content)

    return header + cluster


def main():
    source = find_source_webm()
    if not source:
        print('ERROR: No Playwright WebM recording found in test-results/')
        print('Run the e2e tests first: npm run test:e2e')
        raise SystemExit(1)

    print(f'Source: {os.path.relpath(source, PROJECT_ROOT)} ({os.path.getsize(source) // 1024} KB)')

    trimmed = extract_first_frame(source)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'wb') as f:
        f.write(trimmed)

    print(f'Output: public/demo.webm ({len(trimmed)} bytes)')
    print('✅ Demo video generated successfully')


if __name__ == '__main__':
    main()
