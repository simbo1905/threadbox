import { http, HttpResponse } from 'msw';

// Mock responses
export const mockMessageResponse = {
  id: 'msg_01ABC123',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'Hello! This is a mock response from Claude.'
    }
  ],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 10,
    output_tokens: 25
  }
};

export const mockStreamResponse = {
  type: 'message_start',
  message: {
    id: 'msg_stream_01ABC123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: '' }], // Initialize with empty text block
    model: 'claude-sonnet-4-20250514',
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 0 }
  }
};

export const mockFileResponse = {
  id: 'file_01ABC123',
  type: 'file',
  filename: 'test.txt',
  media_type: 'text/plain',
  size: 1024,
  created_at: new Date().toISOString()
};

export const mockErrorResponse = {
  type: 'error',
  error: {
    type: 'invalid_request_error',
    message: 'Invalid request'
  }
};

// MSW handlers
export const anthropicHandlers = [
  // Messages endpoint
  http.post('*/v1/messages', async ({ request }) => {
    const body = await request.json() as any;
    const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
    
    // Simulate error conditions
    if (authHeader && authHeader.includes('invalid-key')) {
      return HttpResponse.json({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Invalid API key'
        }
      }, { status: 401 });
    }
    
    if (authHeader && authHeader.includes('server-error-key')) {
      return HttpResponse.json({
        type: 'error',
        error: {
          type: 'internal_server_error',
          message: 'Internal server error'
        }
      }, { status: 500 });
    }
    
    if (body.model === 'rate-limited-model') {
      return HttpResponse.json({
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded'
        }
      }, { status: 429 });
    }
    
    if (body.max_tokens > 8192) {
      return HttpResponse.json(mockErrorResponse, { status: 400 });
    }
    
    // Check for streaming
    if (body.stream === true) {
      // Return streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send initial message_start event
          controller.enqueue(encoder.encode(`event: message_start\ndata: ${JSON.stringify(mockStreamResponse)}\n\n`));
          
          // Send content_block_start event
          controller.enqueue(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify({
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' }
          })}\n\n`));
          
          // Send content delta
          controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello streaming!' }
          })}\n\n`));
          
          // Send content_block_stop event
          controller.enqueue(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify({
            type: 'content_block_stop',
            index: 0
          })}\n\n`));
          
          // Send message_delta (usage update)
          controller.enqueue(encoder.encode(`event: message_delta\ndata: ${JSON.stringify({
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 15 }
          })}\n\n`));
          
          // Send message_stop event
          controller.enqueue(encoder.encode(`event: message_stop\ndata: {}\n\n`));
          
          controller.close();
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }
    
    // Regular message response
    return HttpResponse.json(mockMessageResponse);
  }),

  // Files endpoint
  http.post('*/v1/files', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return HttpResponse.json(mockErrorResponse, { status: 400 });
    }
    
    return HttpResponse.json(mockFileResponse);
  }),

];