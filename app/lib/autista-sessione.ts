import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";
export const COOKIE = "roma_rta_autista_session";
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const generaToken = () => randomBytes(32).toString("hex");
export async function sessioneAutista() {
 const token = (await cookies()).get(COOKIE)?.value;
 if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
 const db=createSupabaseServerClient(); if(!db)return null;
 const {data,error}=await db.rpc("roma_rta_autista_sessione",{p_token_hash:sha(token)});
 if(error || !Array.isArray(data) || data.length!==1)return null;
 return data[0] as {autista_id:string;nome:string;cognome:string;numero_tessera:number|null;anno_tessera:number|null};
}
export function origineValida(req:Request){
 const origin=req.headers.get("origin");
 if(!origin)return false;
 try {return new URL(origin).origin===new URL(req.url).origin;}catch{return false;}
}
export const noStore={"Cache-Control":"no-store"};
