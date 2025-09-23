// Peppol API configuration
const PEPPOL_API_BASE = 'https://peppol.helger.com/api';
const NETLIFY_PROXY = '/.netlify/functions/helger-proxy?endpoint='; // works on Netlify sites
// Always use production SML
const SML_ID = 'digitprod';

// Derive a human-readable Access Point name from an SMP Host URI
function getAccessPointNameFromSmpUri(smpHostUri) {
    if (!smpHostUri || typeof smpHostUri !== 'string') return 'Not available';
    try {
        const url = new URL(smpHostUri);
        const host = url.hostname;
        // Known mappings (extend over time)
        if (host.includes('storecove')) return 'Storecove';
        if (host === 'smp.peppol.comax.be' || host.includes('comax.be')) return 'Comax';
        // Default to prettified hostname
        return host.replace(/^www\./, '');
    } catch (_) {
        // Fallback if not a valid URL
        const match = (smpHostUri.match(/https?:\/\/([^\/]*)/) || [])[1];
        if (match) {
            if (match.includes('storecove')) return 'Storecove';
            if (match === 'smp.peppol.comax.be' || match.includes('comax.be')) return 'Comax';
            return match.replace(/^www\./, '');
        }
        return smpHostUri;
    }
}

// Map software providers based on the technical contact email (extend as needed)
function mapSoftwareProviders(technicalContact, accessPointName) {
    if (!technicalContact && !accessPointName) return 'Unknown';
    const v = (technicalContact || '').toString().toLowerCase();
    const ap = (accessPointName || '').toString();
    // Direct email/URL mappings
    if (v === 'openpeppol@exact.com') return 'Exact Online';
    if (v === 'peppol@storecove.com') return 'Accountable, Lucy or Yuki';
    if (v === 'support@okioki.be') return 'OkiOki';
    if (v === 'support@billit.com') return 'Billit';
    if (v === 'peppol@teamleader.eu') return 'Teamleader';
    if (v === 'https://codabox.com') return 'Doccle or Clearfacts';
    if (v === 'support@babelway.com') return 'Mercurius';
    if (v === 'info@dokapi.io') return 'Dokapi (previously: Ixor Docs)';
    if (v === 'support@e-invoice.be') return 'e-invoice.be';
    // AP-name-specific mapping
    if (ap === 'Tradeshift Belgium') return 'Mercurius';
    return 'Unknown';
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
        throw new Error('Invalid format. Belgian VAT/entrepreneur numbers should be 10 digits.');
    }
    
    // Format as Peppol participant ID for Belgian companies
    // Belgian scheme is 0208 according to ISO 6523
    return `iso6523-actorid-upis::0208:${cleaned}`;
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
    btnText.style.display = loading ? 'none' : 'inline';
    btnSpinner.style.display = loading ? 'inline' : 'none';
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
                throw new Error('Company not found in Peppol network');
            } else if (response.status >= 500) {
                throw new Error('Peppol service temporarily unavailable');
            } else {
                throw new Error(`API error: ${response.status}`);
            }
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            if (location && location.protocol === 'file:') {
                throw new Error('Network request was blocked by the browser when opened from a local file. Please run this page via a local web server or deploy it to a web host.');
            }
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

// Extract company information from API responses
function extractCompanyInfo(businessCardData, smpData, existenceData) {
    const info = {
        companyName: 'Not available',
        technicalContact: 'Not available',
        country: 'Not available',
        additionalInfo: 'Not available',
        smpHostUri: 'Not available',
        participantExists: false,
        accessPointName: 'Not available',
        serviceEndpoint: 'Not available'
    };
    
    // Extract existence info
    if (existenceData) {
        info.participantExists = existenceData.exists || false;
        info.smpHostUri = existenceData.smpHostURI || 'Not available';
        if (info.smpHostUri && info.smpHostUri !== 'Not available') {
            info.accessPointName = getAccessPointNameFromSmpUri(info.smpHostUri);
        }
    }
    
    // Extract business card info
    if (businessCardData && businessCardData.entity && businessCardData.entity.length > 0) {
        const entity = businessCardData.entity[0];
        
        if (entity.name && entity.name.length > 0) {
            info.companyName = entity.name[0].name || 'Not available';
        }
        
        info.country = entity.countrycode || 'Not available';
        info.additionalInfo = entity.additionalinfo || 'Not available';
        
        // Technical contact might be in additional info or contact details
        if (entity.contact && entity.contact.length > 0) {
            const contact = entity.contact[0];
            info.technicalContact = contact.name || contact.email || 'Not available';
        }
    }
    
    return info;
}

// Display company information
function displayCompanyInfo(info) {
    const companyInfoDiv = document.getElementById('companyInfo');

    const hideSmpHost = (info.technicalContact || '').toString().toLowerCase() === 'peppol@teamleader.eu';

    companyInfoDiv.innerHTML = `
        <div class="info-item">
            <span class="info-label">🏢 Company Name:</span>
            <span class="info-value">${info.companyName}</span>
        </div>
        
        <div class="info-item">
            <span class="info-label">🧩 Software providers using this accesspoint:</span>
            <span class="info-value">${info.softwareProviders || 'Unknown'}</span>
        </div>
        
        <div class="info-item">
            <span class="info-label">👨‍💼 Technical Contact:</span>
            <span class="info-value">${info.technicalContact}</span>
        </div>
        
        <div class="info-item">
            <span class="info-label">📡 Access Point:</span>
            <span class="info-value">${info.accessPointName}</span>
        </div>
        
        <div class="info-item">
            <span class="info-label">🛰️ Service Endpoint:</span>
            <span class="info-value url">${info.serviceEndpoint}</span>
        </div>
        ${hideSmpHost ? '' : `
        <div class="info-item">
            <span class="info-label">🔗 SMP Host URI:</span>
            <span class="info-value url">${info.smpHostUri}</span>
        </div>`}

        <div class="info-item">
            <span class="info-label">✅ Peppol Network Status:</span>
            <span class="info-value">${info.participantExists ? 'Active participant' : 'Not found in network'}</span>
        </div>
    `;
    
    showSection('results');
}

// Main lookup function
async function performLookup() {
    const input = document.getElementById('companyNumber').value.trim();
    
    if (!input) {
        showError('Please enter a Belgian VAT or entrepreneur number.');
        return;
    }
    
    try {
        // Format and validate the input
        const participantId = formatBelgianNumber(input);
        const encodedParticipantId = encodeParticipantId(participantId);
        
        setButtonLoading(true);
        showSection('loading');
        
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
        
        // Check if participant exists at all
        if (existence && !existence.exists) {
            showError('This company is not registered in the Peppol network.');
            return;
        }
        
        // If no data was retrieved successfully, show error
        if (!existence && !businessCard && !smp) {
            showError('Unable to retrieve company information. The company may not be registered in the Peppol network or the service is temporarily unavailable.');
            return;
        }
        // Extract base company information
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
                            if (ep.technicalContactUrl && (!companyInfo.technicalContact || companyInfo.technicalContact === 'Not available')) {
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
                        if ((companyInfo.technicalContact && companyInfo.technicalContact !== 'Not available') || (companyInfo.accessPointName && companyInfo.accessPointName !== 'Not available')) break;
                    }
                }
            }
        } catch (e) {
            // Ignore errors in technical contact enrichment, continue showing base info
            console.warn('Technical contact enrichment failed:', e);
        }

        // Derive software providers mapping from technical contact
        // Only set via mapping if not determined by special-case (e.g., Hermes)
        if (!companyInfo.softwareProviders) {
            companyInfo.softwareProviders = mapSoftwareProviders(companyInfo.technicalContact, companyInfo.accessPointName);
        }

        // Display company information
        displayCompanyInfo(companyInfo);
        
    } catch (error) {
        console.error('Lookup error:', error);
        showError(error.message || 'An unexpected error occurred during lookup.');
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
});

// Make performLookup available globally
window.performLookup = performLookup;
