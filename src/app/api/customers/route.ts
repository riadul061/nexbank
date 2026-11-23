import { body, query, route } from '@/lib/api';
import { customerFilterSchema, listCustomers, registerSchema, registerUser } from '@/lib/services/customers';
export const GET = route(['ADMIN', 'STAFF'], async ({ req, user }) => listCustomers(query(req, customerFilterSchema), user));
export const POST = route(['ADMIN', 'STAFF'], async ({ req, user }) => registerUser(user, await body(req, registerSchema)));
