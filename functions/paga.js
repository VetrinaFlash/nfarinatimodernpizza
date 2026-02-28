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
        const apiKey = context.env.SUMUP_API_KEY;
        
        // 1. Controllo di sicurezza Variabile d'ambiente
        if (!apiKey) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: "La variabile SUMUP_API_KEY non è configurata o non viene letta da Cloudflare." 
            }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        // 2. CHIAMATA A SUMUP: Recupero in automatico il Merchant Code (Obbligatorio per i Checkout)
        const meResponse = await fetch("https://api.sumup.com/v0.1/me", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        });
        
        const meData = await meResponse.json();
        
        // Se la prima chiamata fallisce, significa che l'API KEY è sbagliata
        if (!meResponse.ok) {
            const errAuth = meData.error_description || meData.error || JSON.stringify(meData);
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Token Rifiutato da SumUp: ${errAuth}` 
            }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        const merchantCode = meData.merchant_profile?.merchant_code;
        
        if (!merchantCode) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: "Impossibile recuperare il Merchant Code dall'account SumUp associato." 
            }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        // 3. CREAZIONE DEL CHECKOUT
        const sumupUrl = "https://api.sumup.com/v0.1/checkouts";

        const sumupPayload = {
            checkout_reference: orderId,
            amount: parseFloat(totalAmount.toFixed(2)),
            currency: "EUR",
            merchant_code: merchantCode,
            description: "Ordine N'Farinati Delivery",
            return_url: "https://nfarinatimodernpizza.pages.dev/successo.html" 
        };

        const sumupResponse = await fetch(sumupUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}` 
            },
            body: JSON.stringify(sumupPayload)
        });

        const sumupData = await sumupResponse.json();

        // Se SumUp crea il link di pagamento restituiamo il link
        if (sumupResponse.ok && sumupData.id) {
            const checkoutUrl = `https://pay.sumup.com/checkout/${sumupData.id}`;
            return new Response(JSON.stringify({ success: true, redirectUrl: checkoutUrl }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        } else {
            // Mostra l'errore esatto per capire cosa manca
            const errorMessage = sumupData.error_description || sumupData.error_message || sumupData.message || JSON.stringify(sumupData);
            return new Response(JSON.stringify({ 
                success: false, 
                error: `Errore Creazione Cassa: ${errorMessage}` 
            }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: `Errore Interno: ${error.message}` 
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
}