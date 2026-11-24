import {cookies} from "next/headers";
import {COOKIE,sha,origineValida,noStore} from "@/app/lib/autista-sessione";
import {createSupabaseServerClient} from "@/app/lib/supabase-server";
export async function POST(req:Request){if(!origineValida(req))return Response.json({}, {status:403,headers:noStore});const c=await cookies();const token=c.get(COOKIE)?.value;if(token){const db=createSupabaseServerClient();await db?.rpc("roma_rta_autista_logout",{p_token_hash:sha(token)});}c.delete(COOKIE);return Response.json({ok:true},{headers:noStore});}
