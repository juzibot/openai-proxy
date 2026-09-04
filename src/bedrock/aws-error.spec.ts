import { describeAwsError, toUpstreamHttpException } from './aws-error';

describe('Bedrock error sanitization', () => {
  it('does not read or expose the raw upstream body', async () => {
    const detail = await describeAwsError({
      name: 'AccessDeniedException',
      message: 'Access denied',
      $metadata: { httpStatusCode: 403, requestId: 'aws-request-id' },
      $response: { body: 'sensitive upstream body' },
    });

    expect(detail).toEqual({
      name: 'AccessDeniedException',
      message: 'Access denied',
      statusCode: 403,
      requestId: 'aws-request-id',
    });
    expect(toUpstreamHttpException(detail).getResponse()).toEqual({
      message: 'Access denied',
      upstream: 'bedrock',
    });
  });
});
