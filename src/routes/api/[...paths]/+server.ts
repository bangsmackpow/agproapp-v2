import { api } from '$lib/server/api';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ request, platform }) => {
	return api.fetch(request, platform?.env, platform?.context as any);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
