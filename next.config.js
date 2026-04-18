/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHostname = supabaseUrl
    ? new URL(supabaseUrl).hostname
    : undefined;

const nextConfig = {
    images: {
        domains: supabaseHostname ? [supabaseHostname] : []
    }
}


module.exports = nextConfig
