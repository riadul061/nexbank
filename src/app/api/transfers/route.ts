import { body, route } from '@/lib/api';
import { executeTransfer, transferSchema } from '@/lib/services/transfers';
export const POST = route(['CUSTOMER'], async ({ req, user }) => executeTransfer(user, await body(req, transferSchema)));
