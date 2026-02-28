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
        
        // CHIAMATA A SUMUP
        const sumupUrl = "https://api.sumup.com/v0.1/checkouts";

        // SumUp richiede l'importo in formato decimale (es. 10.50), non in centesimi.
        const sumupPayload = {
            checkout_reference: orderId,
            amount: parseFloat(totalAmount.toFixed(2)),
            currency: "EUR",
            description: "Ordine N'Farinati Delivery",
            return_url: "https://nfarinati.pages.dev/successo.html" 
            // NOTA: ricordati di cambiare qui sopra "nfarinati.pages.dev" con il link vero se lo cambi
        };

        const sumupResponse = await fetch(sumupUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // La chiave API di SumUp va configurata nelle variabili d'ambiente come SUMUP_API_KEY
                "Authorization": `Bearer ${context.env.SUMUP_API_KEY}` 
            },
            body: JSON.stringify(sumupPayload)
        });

        const sumupData = await sumupResponse.json();

        // Se SumUp risponde con successo e ci fornisce un ID di checkout, generiamo l'URL di pagamento
        if (sumupResponse.ok && sumupData.id) {
            const checkoutUrl = `https://pay.sumup.com/checkout/${sumupData.id}`;
            return new Response(JSON.stringify({ success: true, redirectUrl: checkoutUrl }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        } else {
            throw new Error(sumupData.message || "Impossibile generare la pagina di cassa con SumUp.");
        }
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
}