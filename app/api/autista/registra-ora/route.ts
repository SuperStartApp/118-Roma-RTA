import {sessioneAutista,origineValida,noStore} from "@/app/lib/autista-sessione";
import {createSupabaseServerClient} from "@/app/lib/supabase-server";
export async function POST(req:Request){if(!origineValida(req))return Response.json({errore:"Origine non valida"},{status:403,headers:noStore});const s=await sessioneAutista();if(!s)return Response.json({errore:"Non autorizzato"},{status:401,headers:noStore});const body=await req.json().catch(()=>null);const id=body?.id,tipo=body?.tipo;
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)|| !["inizio","fine"].includes(tipo))return Response.json({errore:"Dati non validi"},{status:400,headers:noStore});
 const db=createSupabaseServerClient();if(!db)return Response.json({errore:"Servizio non disponibile"},{status:503,headers:noStore});
 const col=tipo==="inizio"?"ora_inizio_effettiva":"ora_fine_effettiva";
 let q=db.from("prenotazioni").update({[col]:new Date().toISOString()}).eq("id",id).eq("autista_id",s.autista_id).is("annullata_il",null).is(col,null);
 if(tipo==="fine")q=q.not("ora_inizio_effettiva","is",null);
 const {data,error}=await q.select("id").maybeSingle();if(error)return Response.json({errore:"Errore di aggiornamento"},{status:500,headers:noStore});if(!data)return Response.json({errore:"Corsa non assegnata, annullata o già aggiornata"},{status:409,headers:noStore});return Response.json({ok:true},{headers:noStore});}
