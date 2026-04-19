import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/libs/supabaseAdmin';

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const fullName =
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined;
    const avatarUrl = user.user_metadata?.avatar_url ?? undefined;

    const payload: {
      id: string;
      full_name?: string;
      avatar_url?: string;
    } = {
      id: user.id,
    };

    if (typeof fullName === 'string' && fullName.length > 0) {
      payload.full_name = fullName;
    }

    if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
      payload.avatar_url = avatarUrl;
    }

    const { error } = await supabaseAdmin
      .from('users')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ensured: true }, { status: 200 });
  } catch (error: any) {
    console.log(error);
    return new NextResponse(error?.message || 'Internal Error', { status: 500 });
  }
}