// Peppol API configuration
const PEPPOL_API_BASE = 'https://peppol.helger.com/api';
const NETLIFY_PROXY = '/.netlify/functions/helger-proxy?endpoint='; // works on Netlify sites
// Always use production SML
const SML_ID = 'digitprod';

// Cache last company info for i18n re-rendering
let LAST_COMPANY_INFO = null;

// Derive a human-readable Access Point name from an SMP Host URI
function getAccessPointNameFromSmpUri(smpHostUri) {
    if (!smpHostUri || typeof smpHostUri !== 'string') return I18n?.t('not_available') || 'Not available';
    try {
        const url = new URL(smpHostUri);
        const host = url.hostname;
        // Known mappings (extend over time)
        if (/storecove/i.test(host)) return 'Storecove';
        if (host === 'smp.peppol.comax.be' || /comax\.be/i.test(host)) return 'Comax';
        if (/tradeinterop/i.test(host)) return 'Tradeinterop';
        if (/hermes-belgium\.be/i.test(host)) return 'Ixor Docs';
        if (/tradeshift/i.test(host)) return 'Tradeshift Belgium';
        if (/dokapi/i.test(host)) return 'DokApi';
        if (/e-invoice\.be/i.test(host)) return 'e-invoice';
        if (/onfact\.be/i.test(host)) return 'Infinwebs BV';
        if (/odoo/i.test(host)) return 'Odoo';
        // Default to prettified hostname
        return host.replace(/^www\./, '');
    } catch (_) {
        // Fallback if not a valid URL
        const match = (smpHostUri.match(/https?:\/\/([^\/]*)/) || [])[1];
        if (match) {
            if (/storecove/i.test(match)) return 'Storecove';
            if (match === 'smp.peppol.comax.be' || /comax\.be/i.test(match)) return 'Comax';
            if (/tradeinterop/i.test(match)) return 'Tradeinterop';
            if (/hermes-belgium\.be/i.test(match)) return 'Ixor Docs';
            if (/tradeshift/i.test(match)) return 'Tradeshift Belgium';
            if (/dokapi/i.test(match)) return 'DokApi';
            if (/e-invoice\.be/i.test(match)) return 'e-invoice';
            if (/onfact\.be/i.test(match)) return 'Infinwebs BV';
            if (/odoo/i.test(match)) return 'Odoo';
            return match.replace(/^www\./, '');
        }
        return smpHostUri;
    }
}

// Map software providers based on the technical contact email (extend as needed)
function mapSoftwareProviders(technicalContact, accessPointName) {
    if (!technicalContact && !accessPointName) return I18n?.t('unknown') || 'Unknown';
    const v = (technicalContact || '').toString().toLowerCase();
    const ap = (accessPointName || '').toString();
    // Direct email/URL mappings
    if (v === 'openpeppol@exact.com') return 'Exact Online';
    if (v === 'peppol@storecove.com') return 'Accountable, Lucy or Yuki';
    if (v === 'support@okioki.be') return 'OkiOki';
    if (v === 'support@billit.com') return 'Billit';
    if (v === 'peppol@teamleader.eu') return 'Teamleader';
    if (v === 'https://codabox.com') return 'Doccle, Clearfacts or Eenvoudigfactureren.be';
    if (v === 'support@babelway.com') return 'Mercurius';
    if (v === 'info@dokapi.io') return 'Dokapi (previously: Ixor Docs)';
    if (v === 'support@e-invoice.be') return 'e-invoice.be';
    if (v === 'support@onfact.be') return 'OnFact';
    if (v === 'peppol.support@odoo.com') return 'Odoo';
    // AP-name-specific mapping
    if (ap === 'Tradeshift Belgium') return 'Mercurius';
    // Fallback to AP name if we don't have a richer mapping, so it's not unknown
    return ap || (I18n?.t('unknown') || 'Unknown');
}

// Belgian VAT number validation and formatting
function formatBelgianNumber(input) {
    // Remove spaces and convert to uppercase
    let cleaned = input.replace(/\s/g, '').toUpperCase();
    
    // Remove BE prefix if present
    if (cleaned.startsWith('BE')) {
        cleaned = cleaned.substring(2);
    }
    
    // Validate format (should be 10 digits)
    if (!/^\d{10}$/.test(cleaned)) {
        throw new Error(I18n?.t('error_invalid_format') || 'Invalid format. Belgian VAT/entrepreneur numbers should be 10 digits.');
    }
    
    // Format as Peppol participant ID for Belgian companies
    // Belgian scheme is 0208 according to ISO 6523
    return `iso6523-actorid-upis::0208:${cleaned}`;
}

// Belgian VAT number formatted for scheme 9925 with BE prefix (BEXXXXXXXXXX)
function formatBelgianNumber9925(input) {
    // Remove spaces and convert to uppercase
    let cleaned = input.replace(/\s/g, '').toUpperCase();
    if (cleaned.startsWith('BE')) {
        cleaned = cleaned.substring(2);
    }
    if (!/^\d{10}$/.test(cleaned)) {
        throw new Error(I18n?.t('error_invalid_format') || 'Invalid format. Belgian VAT/entrepreneur numbers should be 10 digits.');
    }
    // Scheme 9925 requires the BE prefix before the number
    return `iso6523-actorid-upis::9925:BE${cleaned}`;
}

// Show/hide UI sections
function showSection(sectionId) {
    document.getElementById('results').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
    
    if (sectionId) {
        document.getElementById(sectionId).style.display = 'block';
    }
}

// Show error message
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    showSection('error');
}

// Update button state
function setButtonLoading(loading) {
    const btn = document.getElementById('lookupBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    
    btn.disabled = loading;
    // Keep text visible; spinner may not exist
    if (btnText) btnText.style.display = 'inline';
    if (btnSpinner) btnSpinner.style.display = loading ? 'inline' : 'none';
}

// Format participant ID for URL encoding
function encodeParticipantId(participantId) {
    return encodeURIComponent(participantId);
}

// Fetch data from Peppol API with error handling
async function fetchPeppolData(endpoint) {
    try {
        // Prefer calling through Netlify Function to avoid browser CORS issues
        let response;
        try {
            response = await fetch(`${NETLIFY_PROXY}${encodeURIComponent(endpoint)}`);
        } catch (proxyErr) {
            // If proxy is not available (e.g., local file or other hosting), fall back to direct API
            response = await fetch(`${PEPPOL_API_BASE}${endpoint}`);
        }
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(I18n?.t('error_company_not_found') || 'Company not found in Peppol network');
            } else if (response.status >= 500) {
                throw new Error(I18n?.t('error_service_unavailable') || 'Peppol service temporarily unavailable');
            } else {
                const msg = (I18n?.t('error_api_error', { status: response.status }) || `API error: ${response.status}`);
                throw new Error(msg);
            }
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            if (location && location.protocol === 'file:') {
                throw new Error(I18n?.t('error_network_local_file') || 'Network request was blocked by the browser when opened from a local file. Please run this page via a local web server or deploy it to a web host.');
            }
            throw new Error(I18n?.t('error_network_generic') || 'Network error. Please check your internet connection.');
        }
        throw error;
    }
}

// Extract company information from API responses
function extractCompanyInfo(businessCardData, smpData, existenceData) {
    // Use nulls for unknown values; translate only when rendering
    const info = {
        companyName: null,
        technicalContact: null,
        country: null,
        additionalInfo: null,
        smpHostUri: null,
        participantExists: false,
        accessPointName: null,
        serviceEndpoint: null
    };
    
    // Extract existence info
    if (existenceData) {
        info.participantExists = existenceData.exists || false;
        info.smpHostUri = existenceData.smpHostURI || null;
        if (info.smpHostUri) {
            info.accessPointName = getAccessPointNameFromSmpUri(info.smpHostUri);
        }
    }
    
    // Extract business card info (primary)
    if (businessCardData && businessCardData.entity && businessCardData.entity.length > 0) {
        const entity = businessCardData.entity[0];
        if (entity.name && entity.name.length > 0) {
            info.companyName = entity.name[0].name || null;
        }
        info.country = entity.countrycode || null;
        info.additionalInfo = entity.additionalinfo || null;
        if (entity.contact && entity.contact.length > 0) {
            const contact = entity.contact[0];
            info.technicalContact = contact.name || contact.email || null;
        }
    } else if (smpData && smpData.businesscard && smpData.businesscard.entity && smpData.businesscard.entity.length > 0) {
        // Fallback: parse business card from SMP response when provided via ?businessCard=true
        const entity = smpData.businesscard.entity[0];
        if (entity.name && entity.name.length > 0) {
            info.companyName = info.companyName || (entity.name[0].name || null);
        }
        info.country = info.country || entity.countrycode || null;
        info.additionalInfo = info.additionalInfo || entity.additionalinfo || null;
        if (entity.contact && entity.contact.length > 0) {
            const contact = entity.contact[0];
            info.technicalContact = info.technicalContact || contact.name || contact.email || null;
        }
    }
    // If we have any business card data (primary or via SMP), and existence wasn't explicitly false, set exists
    if ((businessCardData || (smpData && smpData.businesscard)) && (existenceData == null || typeof existenceData.exists === 'undefined')) {
        info.participantExists = true;
    }
    
    return info;
}

// Build HTML block for a single company info panel
function buildCompanyInfoHtml(info, heading) {
    const notAvail = I18n?.t('not_available') || 'Not available';
    return `
        <div role="group" aria-label="${heading}" style="flex:1; min-width:320px; padding:16px; border:1px solid #e5e7eb; border-radius:10px; background:#fff;">
            <div class="panel-title" style="font-weight:700; font-size:18px; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb;">
                ${heading}
            </div>
            <div class="info-item">
                <span class="info-label">${I18n?.t('label_company_name') || '🏢 Company Name:'}</span>
                <span class="info-value">${info.companyName || notAvail}</span>
            </div>
            <div class="info-item">
                <span class="info-label">${I18n?.t('label_software_providers') || '🧩 Software providers using this accesspoint:'}</span>
                <span class="info-value">${info.softwareProviders || (I18n?.t('unknown') || 'Unknown')}</span>
            </div>
            <div class="info-item">
                <span class="info-label">${I18n?.t('label_technical_contact') || '👨‍💼 Technical Contact:'}</span>
                <span class="info-value">${info.technicalContact || notAvail}</span>
            </div>
            <div class="info-item">
                <span class="info-label">${I18n?.t('label_access_point') || '📡 Access Point:'}</span>
                <span class="info-value">${info.accessPointName || notAvail}</span>
            </div>
        </div>
    `;
}

// Display two company information panels side-by-side
function displayCompanyInfoPair(info0208, info9925) {
    const companyInfoDiv = document.getElementById('companyInfo');
    // Widen layout to use more of the page width
    try {
        companyInfoDiv.style.maxWidth = '1400px';
        companyInfoDiv.style.margin = '0 auto';
        companyInfoDiv.style.width = '100%';
        const results = document.getElementById('results');
        if (results) {
            results.style.maxWidth = '100%';
        }
    } catch(_) { /* ignore */ }
    const h0208 = I18n?.t('result_title_0208') || 'Result for Belgium CBE number';
    const h9925 = I18n?.t('result_title_9925') || 'Result for Belgium VAT number';
    const exists0208 = !!info0208 && (info0208.participantExists !== false);
    const exists9925 = !!info9925 && (info9925.participantExists !== false);

    // Hermes-specific: if any result indicates Hermes, show only the Hermes warning and hide all other info/warnings
    const hermesDetected = [info0208, info9925].some(i => i && typeof i.softwareProviders === 'string' && /hermes/i.test(i.softwareProviders));
    if (hermesDetected) {
        const lang = (window.I18n?.current || 'en');
        const allowed = ['en','nl','fr'];
        const l = allowed.includes(lang) ? lang : 'en';
        const url = `https://signup.teamleader.eu/?country=BE&lang=${l}`;
        companyInfoDiv.innerHTML = `
            <div class="results-display" role="region" aria-live="polite">
                <div class="rd-row">
                    <div class="illus" aria-hidden="true">
                        <div class="dot"></div>
                        <div class="bar1"></div>
                        <div class="bar2"></div>
                    </div>
                    <div class="rd-col">
                        <div class="heading2">${I18n?.t('hermes_warn_title') || 'Your current Peppol connection will stop 31/12/2025'}</div>
                        <div class="paragraph">${I18n?.t('hermes_warn_subtitle') || 'You are using the government Hermes platform to receive invoices via Peppol. This will stop working 31/12/2025'}</div>
                    </div>
                </div>
                <div class="actions">
                    <div class="btn-row">
                        <a class="btn-primary" href="${url}" target="_blank" rel="noopener">${I18n?.t('hermes_warn_cta') || 'Enable Peppol with Teamleader'}</a>
                    </div>
                </div>
            </div>`;
        showSection('results');
        LAST_COMPANY_INFO = { info0208, info9925 };
        return;
    }

    // Helper: build missing banner HTML
    const banner = (text) => `
        <div style="background:#fff7ed; color:#9a3412; border:1px solid #fdba74; padding:10px 12px; border-radius:8px; margin-bottom:12px;">
            ${text}
        </div>`;

    // If both missing -> show ResultsDisplay card with CTA and secondary action
    if (!exists0208 && !exists9925) {
        const lang = (window.I18n?.current || 'en');
        const allowed = ['en','nl','fr'];
        const l = allowed.includes(lang) ? lang : 'en';
        const url = `https://signup.teamleader.eu/?country=BE&lang=${l}`;
        companyInfoDiv.innerHTML = `
            <div class="results-display" role="region" aria-live="polite">
                <div class="rd-row">
                    <div class="illus" aria-hidden="true">
                        <div class="dot"></div>
                        <div class="bar1"></div>
                        <div class="bar2"></div>
                    </div>
                    <div class="rd-col">
                        <div class="heading2">${I18n?.t('both_not_found_title') || (I18n?.t('msg_not_on_peppol') || 'You are not on Peppol')}</div>
                        <div class="paragraph">${I18n?.t('both_not_found_paragraph') || 'The number you entered is not currently registered'}</div>
                    </div>
                </div>
                <div class="actions">
                    <div class="heading3">${I18n?.t('both_not_found_actions_title') || 'What would you like to do?'}</div>
                    <div class="btn-row">
                        <a class="btn-primary" href="${url}" target="_blank" rel="noopener">${I18n?.t('cta_start_peppol') || 'Start with Peppol'}</a>
                        <a class="btn-secondary" href="https://www.teamleader.eu/nl-be/blog/teamleader-focus-peppol-partner" target="_blank" rel="noopener">${I18n?.t('both_not_found_secondary') || 'Know more about Peppol?'}</a>
                    </div>
                </div>
            </div>
        `;
        showSection('results');
        LAST_COMPANY_INFO = { info0208, info9925 };
        return;
    }

    // Build layout panels first, then show a single banner below if one scheme is missing
    const parts = [];
    let bottomBanner = '';
    // Decide panel rendering
    if (exists0208 && exists9925) {
        const sameAP = (
            info0208?.accessPointName && info9925?.accessPointName &&
            String(info0208.accessPointName).toLowerCase() === String(info9925.accessPointName).toLowerCase()
        );
        if (sameAP) {
            parts.push(`
                <div style="display:flex; gap:20px; align-items:stretch; flex-wrap:wrap; width:100%;">
                    ${buildCompanyInfoHtml(info0208, h0208)}
                </div>
            `);
        } else {
            parts.push(`
                <div style="display:flex; gap:20px; align-items:stretch; flex-wrap:wrap; width:100%; justify-content:space-between;">
                    ${buildCompanyInfoHtml(info0208, h0208)}
                    ${buildCompanyInfoHtml(info9925, h9925)}
                </div>
            `);
        }
    } else if (exists0208) {
        parts.push(`
            <div style="display:flex; gap:20px; align-items:stretch; flex-wrap:wrap; width:100%;">
                ${buildCompanyInfoHtml(info0208, h0208)}
            </div>
        `);
        bottomBanner = banner(I18n?.t('msg_9925_missing') || '9925 is not registered on Peppol');
    } else if (exists9925) {
        parts.push(`
            <div style="display:flex; gap:20px; align-items:stretch; flex-wrap:wrap; width:100%;">
                ${buildCompanyInfoHtml(info9925, h9925)}
            </div>
        `);
        bottomBanner = banner(I18n?.t('msg_0208_missing') || '0208 is not registered on Peppol');
    }

    companyInfoDiv.innerHTML = parts.join('\n') + (bottomBanner ? `\n<div style=\"margin-top:12px;\">${bottomBanner}</div>` : '');
    showSection('results');
    LAST_COMPANY_INFO = { info0208, info9925 };
}

// Helper to perform a single participant lookup using existing logic
async function lookupByEncodedId(encodedParticipantId) {
    // Make parallel API calls to get all required information
    const [existenceData, businessCardData, smpData] = await Promise.allSettled([
        fetchPeppolData(`/ppidexistence/${SML_ID}/${encodedParticipantId}`),
        fetchPeppolData(`/businesscard/${SML_ID}/${encodedParticipantId}`),
        fetchPeppolData(`/smpquery/${SML_ID}/${encodedParticipantId}?businessCard=true`)
    ]);
    // Process results - some calls might fail, that's okay
    const existence = existenceData.status === 'fulfilled' ? existenceData.value : null;
    const businessCard = businessCardData.status === 'fulfilled' ? businessCardData.value : null;
    const smp = smpData.status === 'fulfilled' ? smpData.value : null;

    if (existence && !existence.exists) {
        // Return a minimal object indicating non-existence
        return extractCompanyInfo(null, null, existence);
    }
    if (!existence && !businessCard && !smp) {
        return null;
    }
    const companyInfo = extractCompanyInfo(businessCard, smp, existence);

    // Enrich with detailed SMP endpoint lookup to determine technical contact and access point when needed
    try {
        if (smp && smp.urls && smp.urls.length > 0) {
            // Prefer the UBL Invoice doc type if present, otherwise use the first
            let preferred = smp.urls.find(u => (u.documentTypeID || '').includes('Invoice-2')) || smp.urls[0];
            const docTypeID = preferred.documentTypeID;
            if (docTypeID) {
                const detailed = await fetchPeppolData(`/smpquery/${SML_ID}/${encodedParticipantId}/${encodeURIComponent(docTypeID)}`);
                const processes = detailed && detailed.serviceinfo && detailed.serviceinfo.processes || [];
                for (const proc of processes) {
                    const endpoints = proc.endpoints || [];
                    for (const ep of endpoints) {
                        // Capture and normalize technical contact (strip mailto: if present)
                        if (ep.technicalContactUrl && !companyInfo.technicalContact) {
                            const rawContact = String(ep.technicalContactUrl);
                            const normalizedContact = rawContact.toLowerCase().startsWith('mailto:') ? rawContact.slice(7) : rawContact;
                            companyInfo.technicalContact = normalizedContact;
                        }
                        // Set AP directly from specific technical contact rules
                        if (ep.technicalContactUrl) {
                            const raw = String(ep.technicalContactUrl);
                            const t = raw.toLowerCase().startsWith('mailto:') ? raw.slice(7).toLowerCase() : raw.toLowerCase();
                            if (t === 'support@babelway.com') {
                                companyInfo.accessPointName = 'Babelway';
                                companyInfo.softwareProviders = 'Mercurius';
                            }
                            if (t === 'info@dokapi.io') {
                                companyInfo.accessPointName = 'DokApi';
                            }
                            if (t === 'peppol@teamleader.eu') {
                                companyInfo.accessPointName = 'Teamleader';
                                companyInfo.softwareProviders = 'Teamleader Focus, Teamleader One, Dexxter or Teamleader Orbit';
                            }
                            if (t === 'support@e-invoice.be') {
                                companyInfo.accessPointName = 'e-invoice';
                                companyInfo.softwareProviders = 'e-invoice.be';
                            }
                            if (t === 'support@onfact.be') {
                                companyInfo.accessPointName = 'Infinwebs BV';
                                companyInfo.softwareProviders = 'OnFact';
                            }
                            if (t === 'peppol.support@odoo.com') {
                                companyInfo.accessPointName = 'Odoo';
                                companyInfo.softwareProviders = 'Odoo';
                            }
                        }
                        // If technical contact is Codabox URL, set AP to Codabox
                        if (ep.technicalContactUrl && String(ep.technicalContactUrl).toLowerCase() === 'https://codabox.com') {
                            companyInfo.accessPointName = 'Codabox';
                        }
                        // Determine Access Point more accurately if not already a known name
                        if (ep.endpointReference) {
                            try {
                                const url = new URL(ep.endpointReference);
                                const host = url.hostname.toLowerCase();
                                // Record service endpoint by default; may be overridden by special cases
                                companyInfo.serviceEndpoint = ep.endpointReference;
                                if (host.includes('tradeinterop')) {
                                    companyInfo.accessPointName = 'Tradeinterop';
                                } else if (host.includes('storecove')) {
                                    companyInfo.accessPointName = 'Storecove';
                                } else if (host.includes('hermes-belgium.be')) {
                                    // Hermes endpoint implies AP Ixor Docs
                                    companyInfo.accessPointName = 'Ixor Docs';
                                    companyInfo.softwareProviders = 'Hermes';
                                } else if (host.includes('tradeshift')) {
                                    // For Belgian participants, denote Tradeshift Belgium
                                    if (companyInfo.country === 'BE') {
                                        companyInfo.accessPointName = 'Tradeshift Belgium';
                                    } else {
                                        companyInfo.accessPointName = 'Tradeshift';
                                    }
                                }
                            } catch (_) { /* ignore */ }
                        }
                        // Explicit Hermes endpoint URL check
                        if (ep.endpointReference === 'https://ap.hermes-belgium.be/as4') {
                            companyInfo.accessPointName = 'Ixor Docs';
                            companyInfo.softwareProviders = 'Hermes';
                            companyInfo.serviceEndpoint = ep.endpointReference;
                        }
                        // If Teamleader contact, override service endpoint to Teamleader AS4
                        if (companyInfo.accessPointName === 'Teamleader') {
                            companyInfo.serviceEndpoint = 'https://peppol.teamleader.eu/as4';
                        }
                        // Also check certificate subject organization or service description for AP name
                        const subj = ep.certificateDetails && ep.certificateDetails.subject && ep.certificateDetails.subject.O;
                        if (subj && typeof subj === 'string') {
                            const org = subj.toLowerCase();
                            if (org.includes('tradeinterop')) companyInfo.accessPointName = 'Tradeinterop';
                            if (org.includes('storecove')) companyInfo.accessPointName = 'Storecove';
                        }
                        if (ep.serviceDescription && /tradeinterop/i.test(ep.serviceDescription)) {
                            companyInfo.accessPointName = 'Tradeinterop';
                        }
                    }
                    // If we found either technical contact or AP name, we can stop early
                    if (companyInfo.technicalContact || companyInfo.accessPointName) break;
                }
            }
        }
    } catch (e) {
        // Ignore errors in technical contact enrichment, continue showing base info
        console.warn('Technical contact enrichment failed:', e);
    }

    // Derive software providers mapping from technical contact if not set by special-case
    if (!companyInfo.softwareProviders) {
        companyInfo.softwareProviders = mapSoftwareProviders(companyInfo.technicalContact, companyInfo.accessPointName);
    }
    return companyInfo;
}

// Main lookup function
async function performLookup() {
    const input = document.getElementById('companyNumber').value.trim();
    
    if (!input) {
        showError(I18n?.t('error_input_required') || 'Please enter a Belgian VAT or entrepreneur number.');
        return;
    }
    
    try {
        // Format and validate the input for both schemes
        const participantId0208 = formatBelgianNumber(input);
        const participantId9925 = formatBelgianNumber9925(input);
        const encoded0208 = encodeParticipantId(participantId0208);
        const encoded9925 = encodeParticipantId(participantId9925);
        
        setButtonLoading(true);
        showSection('loading');
        
        // Perform both lookups in parallel
        let [info0208, info9925] = await Promise.all([
            lookupByEncodedId(encoded0208),
            lookupByEncodedId(encoded9925)
        ]);

        // Cross-scheme enrichment: copy missing fields in BOTH directions when the other has them
        try {
            if (info0208 && info9925) {
                const fields = ['companyName','country','technicalContact','accessPointName','softwareProviders'];
                for (const f of fields) {
                    if (!info0208[f] && info9925[f]) info0208[f] = info9925[f];
                    if (!info9925[f] && info0208[f]) info9925[f] = info0208[f];
                }
                // Normalize AP name from SMP Host if still missing, and derive providers consistently
                const normalize = (info) => {
                    if (!info) return info;
                    if (!info.accessPointName && info.smpHostUri) {
                        info.accessPointName = getAccessPointNameFromSmpUri(info.smpHostUri);
                    }
                    // Country-specific tweak for Tradeshift generic host
                    if (info.accessPointName === 'Tradeshift' && info.country === 'BE') {
                        info.accessPointName = 'Tradeshift Belgium';
                    }
                    if (!info.softwareProviders) {
                        info.softwareProviders = mapSoftwareProviders(info.technicalContact, info.accessPointName);
                    }
                    return info;
                };
                info0208 = normalize(info0208);
                info9925 = normalize(info9925);
            }
        } catch (_) { /* ignore */ }

        // Pass through raw results (may be null) so renderer can decide messaging/UI
        displayCompanyInfoPair(info0208, info9925);
        
    } catch (error) {
        console.error('Lookup error:', error);
        showError(error.message || I18n?.t('error_lookup_unexpected') || 'An unexpected error occurred during lookup.');
    } finally {
        setButtonLoading(false);
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Allow Enter key to trigger lookup
    document.getElementById('companyNumber').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performLookup();
        }
    });
    
    // Format input as user types
    document.getElementById('companyNumber').addEventListener('input', function(e) {
        // Remove any non-alphanumeric characters except spaces
        let value = e.target.value.replace(/[^a-zA-Z0-9\s]/g, '');
        e.target.value = value;
    });
    // Re-render results on language changes
    document.addEventListener('i18n:applied', () => {
        if (LAST_COMPANY_INFO) {
            if (LAST_COMPANY_INFO.info0208 && LAST_COMPANY_INFO.info9925) {
                displayCompanyInfoPair(LAST_COMPANY_INFO.info0208, LAST_COMPANY_INFO.info9925);
            }
        }
    });

    // Prefill from URL path and auto-run lookup (e.g., /1018174653 or /BE0123456789)
    try {
        const path = (window.location && window.location.pathname) ? window.location.pathname : '';
        // Extract first non-empty segment
        const slug = path.replace(/^\/+/, '').split(/[\/\?#]/)[0];
        if (slug) {
            // Accept digits or BE-prefixed digits
            const normalized = decodeURIComponent(slug).toUpperCase();
            if (/^(BE)?\d{10}$/.test(normalized)) {
                const inputEl = document.getElementById('companyNumber');
                if (inputEl) {
                    inputEl.value = normalized;
                    // Auto-trigger lookup
                    performLookup();
                }
            }
        }
    } catch (_) { /* ignore */ }
});

// Make performLookup available globally
window.performLookup = performLookup;
