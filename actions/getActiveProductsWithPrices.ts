import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { ProductWithPrice } from "@/types";
import { hasSupabaseEnv } from "@/libs/env";

const getActiveProductsWithPrices = async (): Promise<ProductWithPrice[]> => {
  if (!hasSupabaseEnv) {
    return [];
  }

  const supabase = createServerComponentClient({
    cookies: cookies
  });

  const { data, error } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')
    .order('unit_amount', { foreignTable: 'prices' });

  if (error) {
    console.log(error.message);
  }

  return (data as any) || [];
}

export default getActiveProductsWithPrices;