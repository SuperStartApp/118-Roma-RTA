import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
import { COOKIE, sha, generaToken, origineValida, noStore } from "@/app/lib/autista-sessione";
export async function POST(req:Request){
 if(!origineValida(req))return Response.json({errore:"Richiesta non autorizzata"},{status:403,headers:noStore});
 const body=await req.json().catch(()=>null);const pin=body?.pin;
 if(typeof pin!=="string"|| !/^[0-9]{4,6}$/.test(pin))return Response.json({errore:"PIN non valido"},{status:400,headers:noStore});
 const db=createSupabaseServerClient();if(!db)return Response.json({errore:"Servizio non configurato"},{status:503,headers:noStore});
 const h=await headers();const ip=h.get("x-vercel-forwarded-for")?.split(",")[0] || "unknown";
 const token=generaToken();const {data,error}=await db.rpc("roma_rta_autista_login",{p_pin:pin,p_ip_hash:sha(ip),p_token_hash:sha(token)});
 if(error){return Response.json({errore:"Accesso temporaneamente non disponibile"},{status:503,headers:noStore});}
 if(!Array.isArray(data)||data.length!==1)return Response.json({errore:"PIN errato o troppi tentativi. Riprova tra 15 minuti."},{status:401,headers:noStore});
 (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:12*3600});
 return Response.json({ok:true},{headers:noStore});
}
