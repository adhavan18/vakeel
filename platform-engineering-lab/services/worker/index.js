export const handler = async (event) => ({ statusCode: 202, body: JSON.stringify({ accepted: true, requestId: event.requestContext?.requestId ?? 'local' }) });
