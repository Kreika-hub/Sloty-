import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Manejo de CORS (preflight request de los navegadores)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { building_name, admin_name, plan_key, amount, bank, reference, payment_date } = await req.json();

    // Reemplaza ESTE_CORREO_AQUÍ con el correo que usaste para registrarte en Resend
    const TO_EMAIL = Deno.env.get("ADMIN_EMAIL") || "tu-correo@ejemplo.com"; 
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("API Key de Resend no configurada");
    }

    const htmlContent = `
      <h2>Nuevo Comprobante de Pago Subido</h2>
      <p>Un usuario ha subido un nuevo comprobante de pago con los siguientes detalles:</p>
      <ul>
        <li><strong>Edificio:</strong> ${building_name}</li>
        <li><strong>Administrador:</strong> ${admin_name}</li>
        <li><strong>Plan:</strong> ${plan_key}</li>
        <li><strong>Monto:</strong> ${amount}</li>
        <li><strong>Banco:</strong> ${bank}</li>
        <li><strong>Referencia:</strong> ${reference}</li>
        <li><strong>Fecha de Pago:</strong> ${payment_date}</li>
      </ul>
      <br />
      <p>Por favor revisa el comprobante en tu panel de Supabase o Storage para confirmar el pago y activar el servicio.</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: TO_EMAIL, 
        subject: `Nuevo Pago Recibido - ${building_name}`,
        html: htmlContent
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Error desde Resend:", errorText);
      throw new Error("Error enviando email con Resend");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error en notify-new-payment:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
