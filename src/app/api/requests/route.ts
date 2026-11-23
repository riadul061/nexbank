import { body, query, route } from '@/lib/api';
import { createRequest, listRequests, requestFilterSchema, requestSchema } from '@/lib/services/requests';
export const GET = route('any', async ({ req, user }) => listRequests(user, query(req, requestFilterSchema)));
export const POST = route(['CUSTOMER'], async ({ req, user }) => createRequest(user, await body(req, requestSchema)));
