import {sessioneAutista,noStore} from "@/app/lib/autista-sessione";
export async function GET(){const s=await sessioneAutista();return s?Response.json({autista:s},{headers:noStore}):Response.json({errore:"Sessione scaduta"},{status:401,headers:noStore});}
