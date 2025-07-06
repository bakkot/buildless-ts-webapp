// type-only imports get erased entirely, so they can refer to things outside the frontend directory
import type { APIRequest, APIResponse } from '../common/types.ts';

export async function uppercaseViaAPI(input: APIRequest): Promise<APIResponse> {
  const data = await fetch('/api', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return (await data.json()) as APIResponse;
}
