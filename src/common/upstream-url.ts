import { BadRequestException } from '@nestjs/common';

const MAX_SEGMENT_LENGTH = 256;
const MAX_PATH_LENGTH = 1024;

export function encodeUpstreamSegment(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SEGMENT_LENGTH ||
    value === '.' ||
    value === '..' ||
    /[\0/\\?#]/.test(value)
  ) {
    throw new BadRequestException(`Invalid ${field}`);
  }

  return encodeURIComponent(value);
}

export function encodeUpstreamPath(value: string, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH
  ) {
    throw new BadRequestException(`Invalid ${field}`);
  }

  return value
    .split('/')
    .map((segment) => encodeUpstreamSegment(segment, field))
    .join('/');
}

export function safeUpstreamOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid-upstream-url';
  }
}
