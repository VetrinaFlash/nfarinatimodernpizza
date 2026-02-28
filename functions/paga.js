// file: functions/paga.js
export async function onRequest(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (context.request.method === "OPTIONS") { return new Response(null, { headers: corsHeaders }); }
    if (context.request.method !== "POST") { return new Response("Metodo non consentito", { status: 405, headers: corsHeaders }); }

    try {
        const body = await context.request.json();
        const { orderId, totalAmount } = body;
        
        // CONTROLLO DI SICUREZZA: Verifica se hai inserito la variabile su Cloudflare
        if (!context.env.SUMUP_API_KEY) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: "La variabile SUMUP_API_KEY non è configurata nel pannello di Cloudflare!" 
            }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        // CHIAMATA A SUMUP
        const sumupUrl = "https://api.sumup.com/v0.1/checkouts";

        const sumupPayload = {
            checkout_reference: orderId,
            amount: parseFloat(totalAmount.toFixed(2)),
            currency: "EUR",
            description: "Ordine N'Farinati Delivery",
            return_url: "https://nfarinatimodernpizza.pages.dev/successo.html" 
        };

        const sumupResponse = await fetch(sumupUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${context.env.SUMUP_API_KEY}` 
            },
            body: JSON.stringify(sumupPayload)
        });

        const sumupData = await sumupResponse.json();

        // Se SumUp crea il link di pagamento:
        if (sumupResponse.ok && sumupData.id) {
            const checkoutUrl = `https://pay.sumup.com/checkout/${sumupData.id}`;
            return new Response(JSON.stringify({ success: true, redirectUrl: checkoutUrl }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        } else {
            // MOSTRA L'ERRORE ESATTO DI SUMUP
            const errorMessage = sumupData.error_message || sumupData.message || sumupData.error_code || "Errore sconosciuto";
            return new Response(JSON.stringify({ 
                success: false, 
                error: `SumUp risponde: ${errorMessage}` 
            }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: `Errore Interno Server: ${error.message}` 
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
}