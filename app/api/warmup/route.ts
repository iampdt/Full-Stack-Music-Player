import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/libs/supabaseAdmin';

const getProvidedToken = (request: Request) => {
  const bearerToken = request.headers.get('authorization');

  if (bearerToken?.startsWith('Bearer ')) {
    return bearerToken.replace('Bearer ', '').trim();
  }

  const headerToken = request.headers.get('x-warmup-token');
  if (headerToken) {
    return headerToken.trim();
  }

  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get('token');
};

const hasValidToken = (request: Request) => {
  const expectedToken = process.env.WARMUP_TOKEN;

  if (!expectedToken) {
    return {
      ok: false,
      response: new NextResponse('Missing WARMUP_TOKEN env variable.', {
        status: 500,
      }),
    };
  }

  const providedToken = getProvidedToken(request);

  if (!providedToken || providedToken !== expectedToken) {
    return {
      ok: false,
      response: new NextResponse('Unauthorized', { status: 401 }),
    };
  }

  return { ok: true, response: null };
};

const warmDatabase = async () => {
  const { error } = await supabaseAdmin
    .from('products')
    .select('id', { head: true, count: 'exact' })
    .limit(1);

  if (error) {
    throw error;
  }
};

export async function GET(request: Request) {
  const tokenResult = hasValidToken(request);
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  try {
    await warmDatabase();

    return NextResponse.json(
      {
        ok: true,
        warmedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.log('Warmup endpoint failed', error);
    return new NextResponse(error?.message || 'Internal Error', { status: 500 });
  }
}

export async function HEAD(request: Request) {
  const tokenResult = hasValidToken(request);
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  try {
    await warmDatabase();

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.log('Warmup endpoint failed', error);
    return new NextResponse(error?.message || 'Internal Error', { status: 500 });
  }
}
