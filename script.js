// Peppol API configuration
const PEPPOL_API_BASE = 'https://peppol.helger.com/api';
const OPENPEPPOL_API_BASE = 'https://directory.peppol.eu/api';
const ADEMICO_API_BASE = 'https://peppol-tools-api1.ademico-software.com';
const NETLIFY_PROXY = '/.netlify/functions/helger-proxy?endpoint='; // works on Netlify sites
// Always use production SML
const SML_ID = 'digitprod';

// Cache last company info for i18n re-rendering
let LAST_COMPANY_INFO = null;
let AUTO_LOOKUP_RAN = false;

// Add warning icons into the small dot elements of the illustration
function addWarningIcons() {
    try {
        const dots = document.querySelectorAll('.results-display .illus .dot');
        dots.forEach(dot => {
            dot.style.backgroundImage = 'url("Warning_icon.png")';
            dot.style.backgroundSize = 'contain';
            dot.style.backgroundRepeat = 'no-repeat';
            dot.style.backgroundPosition = 'center';
            // Ensure the background color does not hide the icon
            dot.style.backgroundColor = 'transparent';
        });
    } catch (e) {
        console.warn('addWarningIcons failed:', e);
    }
}

// Derive a human-readable Access Point name from an SMP Host URI
function getAccessPointNameFromSmpUri(smpHostUri) {
    if (!smpHostUri || typeof smpHostUri !== 'string') return I18n?.t('not_available') || 'Not available';
    try {
        const url = new URL(smpHostUri);
        const host = url.hostname;
        // Known mappings (extend over time)
        if (/babelway/i.test(host)) return 'Babelway';
        if (/storecove/i.test(host)) return 'Storecove';
        if (host === 'smp.peppol.comax.be' || /comax\.be/i.test(host)) return 'Comax';
        if (/tradeinterop/i.test(host)) return 'Tradeinterop';
        if (/hermes-belgium\.be/i.test(host)) return 'Ixor Docs';
        if (/tradeshift/i.test(host)) return 'Tradeshift Belgium';
        if (/dokapi/i.test(host)) return 'DokApi';
        if (/e-invoice\.be/i.test(host)) return 'e-invoice';
        if (/onfact\.be/i.test(host)) return 'Infinwebs BV';
        if (/odoo/i.test(host)) return 'Odoo';
        if (/codabox\.com/i.test(host)) return 'Codabox';
        if (/billit/i.test(host)) return 'Billit';
        if (/crossinx/i.test(host)) return 'Billtobox';
        if (/octopus/i.test(host)) return 'Octopus';
        // Default to prettified hostname
        return host.replace(/^www\./, '');
    } catch (_) {
        // Fallback if not a valid URL
        const match = (smpHostUri.match(/https?:\/\/([^\/]*)/) || [])[1];
        if (match) {
            if (/babelway/i.test(match)) return 'Babelway';
            if (/storecove/i.test(match)) return 'Storecove';
            if (match === 'smp.peppol.comax.be' || /comax\.be/i.test(match)) return 'Comax';
            if (/tradeinterop/i.test(match)) return 'Tradeinterop';
            if (/hermes-belgium\.be/i.test(match)) return 'Ixor Docs';
            if (/tradeshift/i.test(match)) return 'Tradeshift Belgium';
            if (/dokapi/i.test(match)) return 'DokApi';
            if (/e-invoice\.be/i.test(match)) return 'e-invoice';
            if (/onfact\.be/i.test(match)) return 'Infinwebs BV';
            if (/odoo/i.test(match)) return 'Odoo';
            if (/codabox\.com/i.test(match)) return 'Codabox';
            if (/billit/i.test(match)) return 'Billit';
            if (/crossinx/i.test(match)) return 'Billtobox';
            if (/octopus/i.test(match)) return 'Octopus';
            return match.replace(/^www\./, '');
        }
        return smpHostUri;
    }
}

// Map software providers based on the technical contact email (extend as needed)
function mapSoftwareProviders(technicalContact, accessPointName, documentTypes) {
    if (!technicalContact && !accessPointName) return I18n?.t('unknown') || 'Unknown';
    const v = (technicalContact || '').toString().toLowerCase();
    const ap = (accessPointName || '').toString().toLowerCase();

    const hasSelfBillingInvoiceV3 = (() => {
        if (!documentTypes) return false;
        const label = 'peppol bis self-billing ubl invoice v3';
        const list = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
        return list.some((dt) => {
            const candidates = [];
            if (typeof dt === 'string') candidates.push(dt);
            if (dt && typeof dt === 'object') {
                if (typeof dt.documentTypeName === 'string') candidates.push(dt.documentTypeName);
                if (typeof dt.documentTypeID === 'string') candidates.push(dt.documentTypeID);
                if (typeof dt.niceName === 'string') candidates.push(dt.niceName);
                if (typeof dt.name === 'string') candidates.push(dt.name);
                if (typeof dt.id === 'string') candidates.push(dt.id);
            }
            return candidates.some((c) => {
                const s = String(c).toLowerCase();
                if (s === label) return true;
                if ((s.includes('self-billing') || s.includes('selfbilling')) && s.includes('invoice') && (s.includes('v3') || s.includes('3.0'))) return true;
                // URN-style identifiers
                if (s.includes('poacc:selfbilling:3.0') && s.includes('invoice-2') && s.includes('::invoice')) return true;
                if (s.includes('poacc:selfbilling:3.0') && s.includes('invoice')) return true;
                return false;
            });
        });
    })();
    
    // Direct email/URL mappings
    if (v === 'openpeppol@exact.com') return 'Exact Online';
    if (v === 'peppol@storecove.com') return 'Accountable, Zenvoices, Lucy or Yuki';
    if (v === 'support@okioki.be') return 'OkiOki';
    if (v === 'support@billit.com' || v === 'support@billit.be') return 'Billit';
    if (v === 'peppol@teamleader.eu') {
        if (hasSelfBillingInvoiceV3) return 'Dexxter';
        return 'Teamleader Focus, Teamleader One of Teamleader Orbit';
    }
    if (v === 'https://codabox.com') return 'Doccle, Clearfacts or Eenvoudigfactureren.be';
    if (v === 'support@babelway.com' || v.includes('mercurius') || ap.includes('babelway')) return 'Mercurius';
    if (v === 'info@dokapi.io') return 'Dokapi (previously: Ixor Docs)';
    if (v === 'support@e-invoice.be') return 'e-invoice.be';
    if (v === 'support@onfact.be') return 'OnFact';
    if (v === 'peppol.support@odoo.com') return 'Odoo';
    
    // AP-name-specific mappings
    if (ap.includes('tradeshift')) return 'Mercurius';
    
    // Fallback to AP name if we don't have a richer mapping, so it's not unknown
    if (ap) return accessPointName; // Return the original case of accessPointName
    
    return I18n?.t('unknown') || 'Unknown';
}

// Belgian VAT number validation and formatting
function formatBelgianNumber(input) {
    // Remove spaces, dots and dashes and convert to uppercase
    let cleaned = input.replace(/[\s.\-]/g, '').toUpperCase();
    
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
    // Remove spaces, dots and dashes and convert to uppercase
    let cleaned = input.replace(/[\s.\-]/g, '').toUpperCase();
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

// Direct SMP query using DNS lookup and HTTPS
async function querySMPDirect(participantId) {
    try {
        // Extract scheme and identifier from participant ID
        const match = participantId.match(/iso6523-actorid-upis::(\d+):(.+)/);
        if (!match) {
            throw new Error('Invalid participant ID format');
        }
        
        const [, scheme, identifier] = match;
        
        // Construct DNS query for SMP endpoint
        const dnsQuery = `iso6523-actorid-upis._${scheme}._${identifier}.smp.peppol.org`;
        
        // For browser environment, we can't do direct DNS queries
        // So we'll try common SMP endpoints with HTTPS
        const smpEndpoints = [
            `https://smp.peppol.org`,
            `https://smp1.peppol.org`, 
            `https://smp2.peppol.org`,
            `https://test-infra.peppol.at` // for test participants
        ];
        
        for (const endpoint of smpEndpoints) {
            try {
                const url = `${endpoint}/${encodeURIComponent(participantId)}`;
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/xml,application/vnd.peppol.smp+xml',
                        'User-Agent': 'Peppol-Lookup-Website/1.0'
                    }
                });
                
                if (response.ok) {
                    const xmlText = await response.text();
                    return parseSMPResponse(xmlText, participantId);
                }
            } catch (err) {
                // Continue to next endpoint
                continue;
            }
        }
        
        throw new Error('No SMP endpoints responded');
    } catch (error) {
        throw error;
    }
}

// Parse SMP XML response
function parseSMPResponse(xmlText, participantId) {
    try {
        // Simple XML parsing for basic information
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Check for parsing errors
        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Invalid XML response from SMP');
        }
        
        // Extract basic participant information
        const serviceMetadata = xmlDoc.querySelector('ServiceMetadata');
        if (!serviceMetadata) {
            throw new Error('No service metadata found');
        }
        
        // Extract document types and endpoints
        const documentIdentifiers = xmlDoc.querySelectorAll('DocumentIdentifier');
        const endpoints = xmlDoc.querySelectorAll('Endpoint');
        
        const urls = [];
        documentIdentifiers.forEach(doc => {
            const docId = doc.getAttribute('value');
            if (docId) {
                urls.push({
                    documentTypeID: docId,
                    href: null // Would need to extract from ProcessList/ServiceEndpointReference
                });
            }
        });
        
        // Extract technical contact from endpoints
        let technicalContact = null;
        endpoints.forEach(endpoint => {
            const contact = endpoint.querySelector('TechnicalContact');
            if (contact && !technicalContact) {
                technicalContact = contact.textContent || contact.getAttribute('href');
            }
        });
        
        return {
            participantID: participantId,
            exists: true,
            urls: urls,
            technicalContact: technicalContact,
            smpHostUri: null, // We don't know the exact SMP host
            queryDateTime: new Date().toISOString(),
            queryDurationMillis: 0
        };
    } catch (error) {
        throw new Error(`Failed to parse SMP response: ${error.message}`);
    }
}

// Query Peppol Directory web interface as fourth backup (web scraping)
async function queryPeppolDirectoryWeb(participantId) {
    try {
        // Extract just the identifier part for the web interface
        const identifier = participantId.includes(':') ? participantId.split(':').pop() : participantId;
        
        // Use the working web interface URL
        const webUrl = `https://directory.peppol.eu/public/locale-en_US/menuitem-search?q=${encodeURIComponent(identifier)}`;
        
        const response = await fetch(webUrl, {
            headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (compatible; Peppol-Lookup-Website/1.0)'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Peppol Directory web error: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Check if participant was found
        const foundMatch = html.match(/Found (\d+) entities? matching/i);
        if (!foundMatch || foundMatch[1] === '0') {
            // No entities found
            return {
                participantID: participantId,
                exists: false,
                urls: [],
                businessCard: null,
                companyName: null,
                country: null,
                technicalContact: null,
                smpHostUri: null,
                queryDateTime: new Date().toISOString(),
                queryDurationMillis: 0
            };
        }
        
        // Parse HTML to extract participant information
        // Look for the participant ID and entity name in the HTML
        const entityNameMatch = html.match(/Entity Name:<\/div><div class="col-9 col-lg-10">([^<]+)/i);
        
        if (entityNameMatch && entityNameMatch[1]) {
            const entityName = entityNameMatch[1].trim();
            
            // Try to extract country information
            const countryMatch = html.match(/Country:<\/div><div class="col-9 col-lg-10"><span[^>]*>.*?<\/span> ([A-Z]{2})/i);
            const country = countryMatch ? countryMatch[1] : 'BE'; // Default to Belgium for 0208 scheme
            
            // Try to extract contact information if available
            const contactMatch = html.match(/Contact:<\/div><div class="col-9 col-lg-10">([^<]+)/i);
            const contact = contactMatch ? contactMatch[1].trim() : null;
            
            return {
                participantID: participantId,
                exists: true,
                urls: [], // Web interface doesn't provide document types
                businessCard: {
                    participant: {
                        scheme: 'iso6523-actorid-upis',
                        value: `0208:${identifier}`
                    },
                    entity: [{
                        name: [{ name: entityName }],
                        countryCode: country,
                        contact: contact ? [{
                            contactType: 'Technical',
                            name: contact
                        }] : []
                    }]
                },
                companyName: entityName,
                country: country,
                technicalContact: contact,
                smpHostUri: 'https://smp.peppol.org', // Default SMP for found participants
                queryDateTime: new Date().toISOString(),
                queryDurationMillis: 0
            };
        } else {
            // Participant not found in web interface
            return {
                participantID: participantId,
                exists: false,
                urls: [],
                businessCard: null,
                companyName: null,
                country: null,
                technicalContact: null,
                smpHostUri: null,
                queryDateTime: new Date().toISOString(),
                queryDurationMillis: 0
            };
        }
    } catch (error) {
        throw new Error(`Peppol Directory web scraping failed: ${error.message}`);
    }
}

// Query Helger web interface as fifth backup (web scraping)
async function queryHelgerWebInterface(participantId) {
    try {
        // Extract scheme and identifier from participant ID
        const match = participantId.match(/iso6523-actorid-upis::(\d+):(.+)/);
        if (!match) {
            throw new Error('Invalid participant ID format');
        }
        
        const [, scheme, identifier] = match;
        
        // Use the working Helger web interface URL
        const webUrl = `https://peppol.helger.com/public/locale-en_US/menuitem-tools-participant?scheme=iso6523-actorid-upis&value=${encodeURIComponent(scheme + ':' + identifier)}&sml=peppolprod&querybc=true&verifysignatures=true&xsdvalidation=true&action=perform`;
        
        const response = await fetch(webUrl, {
            headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (compatible; Peppol-Lookup-Website/1.0)'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Helger web interface error: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Check if participant exists by looking for error messages
        if (html.includes('not found') || html.includes('Not registered') || html.includes('Unknown Service Group')) {
            return {
                participantID: participantId,
                exists: false,
                urls: [],
                businessCard: null,
                companyName: null,
                country: null,
                technicalContact: null,
                smpHostUri: null,
                queryDateTime: new Date().toISOString(),
                queryDurationMillis: 0
            };
        }
        
        // Extract business card information if available
        const entityNameMatch = html.match(/Entity Name[^>]*>([^<]+)/i);
        const entityName = entityNameMatch ? entityNameMatch[1].trim() : null;
        
        // Try to extract country information
        const countryMatch = html.match(/Country[^>]*>([^<]+)/i);
        const country = countryMatch ? countryMatch[1].trim() : null;
        
        // Extract document types if available
        const documentTypes = [];
        const docTypeMatches = html.matchAll(/documenttypeid[^>]*>([^<]+)/gi);
        for (const match of docTypeMatches) {
            documentTypes.push({
                documentTypeID: match[1].trim(),
                href: null // Web interface doesn't provide direct URLs
            });
        }
        
        return {
            participantID: participantId,
            exists: true,
            urls: documentTypes,
            businessCard: entityName ? {
                participant: {
                    scheme: 'iso6523-actorid-upis',
                    value: `${scheme}:${identifier}`
                },
                entity: [{
                    name: [{ name: entityName }],
                    countryCode: country || 'BE'
                }]
            } : null,
            companyName: entityName,
            country: country,
            technicalContact: null,
            smpHostUri: null,
            queryDateTime: new Date().toISOString(),
            queryDurationMillis: 0
        };
    } catch (error) {
        throw new Error(`Helger web interface scraping failed: ${error.message}`);
    }
}

// Query Open Peppol Directory API as third backup
async function queryOpenPeppolDirectory(participantId) {
    try {
        // Extract just the identifier part (e.g., 0763763845 from iso6523-actorid-upis::0208:0763763845)
        const identifier = participantId.includes(':') ? participantId.split(':').pop() : participantId;
        
        // Use the correct API endpoint format: /search/1.0/json
        const searchUrl = `${OPENPEPPOL_API_BASE}/search/1.0/json?q=${encodeURIComponent(identifier)}`;
        
        console.log('OpenPeppol Directory API call:', searchUrl);
        
        const response = await fetch(searchUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Peppol-Lookup-Website/1.0'
            }
        });
        
        console.log('OpenPeppol Directory API response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`OpenPeppol Directory API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('OpenPeppol Directory API data:', data);
        
        // Convert OpenPeppol Directory format to our expected format
        if (data && data.matches && data.matches.length > 0) {
            const match = data.matches[0];
            
            // Convert docTypes to urls format
            const urls = match.docTypes ? match.docTypes.map(doc => ({
                documentTypeID: doc.value,
                href: null // API doesn't provide direct URLs
            })) : [];
            
            return {
                participantID: participantId,
                exists: true,
                urls: urls,
                businessCard: {
                    participant: match.participantID,
                    entity: match.entities || []
                },
                companyName: match.entities?.[0]?.name?.[0]?.name || null,
                country: match.entities?.[0]?.countryCode || null,
                technicalContact: null, // OpenPeppol Directory API doesn't provide this
                smpHostUri: null, // API doesn't provide SMP host URI
                queryDateTime: data['creation-dt'] || new Date().toISOString(),
                queryDurationMillis: 0
            };
        } else {
            // No matches found
            return {
                participantID: participantId,
                exists: false,
                urls: [],
                businessCard: null,
                companyName: null,
                country: null,
                technicalContact: null,
                smpHostUri: null,
                queryDateTime: new Date().toISOString(),
                queryDurationMillis: 0
            };
        }
    } catch (error) {
        throw new Error(`OpenPeppol Directory query failed: ${error.message}`);
    }
}

// Fetch data from Peppol API with three-tier fallback: Helger -> SMP -> OpenPeppol Directory
async function fetchPeppolData(endpoint) {
    console.log('=== fetchPeppolData called with endpoint:', endpoint);
    let lastError;
    
    // 1. Try Helger API first (through proxy if available)
    try {
        console.log('Trying Helger API...');
        let response;
        try {
            console.log('Trying proxy:', `${NETLIFY_PROXY}${encodeURIComponent(endpoint)}`);
            response = await fetch(`${NETLIFY_PROXY}${encodeURIComponent(endpoint)}`);
        } catch (proxyErr) {
            console.log('Proxy failed, trying direct API:', `${PEPPOL_API_BASE}${endpoint}`);
            // If proxy is not available (e.g., local file or other hosting), fall back to direct API
            response = await fetch(`${PEPPOL_API_BASE}${endpoint}`);
        }
        
        console.log('Helger API response status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('Helger API success, returning data');
            return data;
        } else {
            // Check if it's a 400 error (service disruption) - if so, try next fallback
            if (response.status === 400) {
                console.log('Helger API returned 400, trying fallbacks');
                lastError = new Error(`Helger API service unavailable (HTTP 400) - trying fallbacks`);
            } else {
                console.log('Helger API returned error:', response.status);
                lastError = new Error(`Helger API error: ${response.status}`);
            }
        }
    } catch (error) {
        console.log('Helger API threw error:', error.message);
        lastError = error;
    }
    
    // 2. Fallback to direct SMP queries for participant existence and metadata
    console.log('Checking if fallback should trigger for endpoint:', endpoint);
    console.log('Endpoint includes /ppidexistence/:', endpoint.includes('/ppidexistence/'));
    console.log('Endpoint includes /smpquery/:', endpoint.includes('/smpquery/'));
    
    if (endpoint.includes('/ppidexistence/') || endpoint.includes('/smpquery/')) {
        console.log('*** ENTERING FALLBACK BLOCK ***');
        console.log('Trying SMP Direct fallback...');
        try {
            const participantId = endpoint.split('/').pop().replace(/%3a%3a/g, '::');
            console.log('SMP Direct participantId:', participantId);
            const smpData = await querySMPDirect(participantId);
            console.log('SMP Direct success, returning data');
            if (endpoint.includes('/ppidexistence/')) {
                return { participantID: participantId, exists: smpData.exists, sml: SML_ID, queryDateTime: smpData.queryDateTime, queryDurationMillis: smpData.queryDurationMillis };
            } else {
                return smpData;
            }
        } catch (smpError) {
            console.log('SMP Direct failed:', smpError.message);
            lastError = smpError;
        }
        
        console.log('Trying OpenPeppol Directory fallback...');
        try {
            const participantId = endpoint.split('/').pop().replace(/%3a%3a/g, '::');
            console.log('OpenPeppol Directory participantId:', participantId);
            const directoryData = await queryOpenPeppolDirectory(participantId);
            console.log('OpenPeppol Directory success, returning data');
            // Always return the complete data, regardless of endpoint type
            return directoryData;
        } catch (directoryError) {
            console.log('OpenPeppol Directory failed:', directoryError.message);
            lastError = directoryError;
        }
        try {
            const participantId = endpoint.split('/').pop().replace(/%3a%3a/g, '::');
            const directoryWebData = await queryPeppolDirectoryWeb(participantId);
            if (endpoint.includes('/ppidexistence/')) {
                return { participantID: participantId, exists: directoryWebData.exists, sml: SML_ID, queryDateTime: directoryWebData.queryDateTime, queryDurationMillis: directoryWebData.queryDurationMillis };
            } else {
                return directoryWebData;
            }
        } catch (directoryWebError) {
            lastError = directoryWebError;
        }
    }
    
    // 3. Fallback to web scraping for participant existence and metadata
    if (endpoint.includes('/ppidexistence/') || endpoint.includes('/smpquery/')) {
        try {
            const participantId = endpoint.split('/').pop().replace(/%3a%3a/g, '::');
            const directoryWebData = await queryPeppolDirectoryWeb(participantId);
            // Always return the complete data, regardless of endpoint type
            return directoryWebData;
        } catch (directoryWebError) {
            lastError = directoryWebError;
        }
        try {
            const participantId = endpoint.split('/').pop().replace(/%3a%3a/g, '::');
            const helgerWebData = await queryHelgerWebInterface(participantId);
            if (endpoint.includes('/ppidexistence/')) {
                return { participantID: participantId, exists: helgerWebData.exists, sml: SML_ID, queryDateTime: helgerWebData.queryDateTime, queryDurationMillis: helgerWebData.queryDurationMillis };
            } else {
                return helgerWebData;
            }
        } catch (helgerWebError) {
            lastError = helgerWebError;
        }
    }
    
    // If all three methods fail, throw the last error
    if (lastError) {
        if (lastError.name === 'TypeError' && lastError.message.includes('fetch')) {
            if (location && location.protocol === 'file:') {
                throw new Error(I18n?.t('error_network_local_file') || 'Network request was blocked by the browser when opened from a local file. Please run this page via a local web server or deploy it to a web host.');
            }
            throw new Error(I18n?.t('error_network') || 'Network error occurred. Please check your internet connection.');
        }
        throw lastError;
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
        serviceEndpoint: null,
        documentTypes: null
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
    // Derive SMP Host URI and AP name from SMP response if provided
    if (smpData) {
        const smpUri = smpData.smpHostURI || smpData.smpHostUri || smpData.host || smpData.smp || null;
        if (!info.smpHostUri && smpUri) info.smpHostUri = smpUri;
        if (!info.accessPointName && info.smpHostUri) {
            try { info.accessPointName = getAccessPointNameFromSmpUri(info.smpHostUri); } catch (_) { /* ignore */ }
        }
        if (!info.documentTypes && smpData.urls) info.documentTypes = smpData.urls;
        // Do not map softwareProviders here yet; wait until we have more complete data
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
    // Always derive the displayed software providers from the final technical contact and access point
    const providers = mapSoftwareProviders(info.technicalContact, info.accessPointName, info.documentTypes);
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
                <span class="info-value">${providers || (I18n?.t('unknown') || 'Unknown')}</span>
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

    const normalize = (s) => {
        if (s == null) return '';
        const str = String(s).trim();
        return str.toLowerCase().startsWith('mailto:') ? str.slice(7).trim().toLowerCase() : str.toLowerCase();
    };

    const areEquivalentResults = (a, b) => {
        if (!a || !b) return false;
        return (
            normalize(a.technicalContact) === normalize(b.technicalContact) &&
            normalize(a.accessPointName) === normalize(b.accessPointName) &&
            normalize(a.softwareProviders) === normalize(b.softwareProviders) &&
            normalize(a.serviceEndpoint) === normalize(b.serviceEndpoint)
        );
    };

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
        // Ensure the warning icon is applied to the dot inside the newly rendered card
        addWarningIcons();
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
        // Ensure the warning icon is applied to the dot inside the newly rendered card
        addWarningIcons();
        LAST_COMPANY_INFO = { info0208, info9925 };
        return;
    }

    // Build layout panels first, then show a single banner below if one scheme is missing
    const parts = [];
    let bottomBanner = '';
    // Decide panel rendering
    if (exists0208 && exists9925) {
        const equivalent = areEquivalentResults(info0208, info9925);
        if (equivalent) {
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
            // Prefer the UBL Invoice doc type(s) if present; if a detail lookup fails, try other document types.
            const urls = smp.urls || [];
            const invoiceUrls = urls.filter(u => (u.documentTypeID || '').includes('Invoice-2'));
            const candidates = [...invoiceUrls, ...urls.filter(u => !invoiceUrls.includes(u))];

            for (const candidate of candidates) {
                const docTypeID = candidate && candidate.documentTypeID;
                if (!docTypeID) continue;

                let detailed;
                try {
                    detailed = await fetchPeppolData(`/smpquery/${SML_ID}/${encodedParticipantId}/${encodeURIComponent(docTypeID)}`);
                } catch (_) {
                    continue;
                }

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
                            
                            // Map technical contacts to their corresponding access points and software providers
                            const contactMappings = [
                                { 
                                    contact: 'support@babelway.com', 
                                    accessPoint: 'Babelway', 
                                    software: 'Mercurius' 
                                },
                                { 
                                    contact: 'info@dokapi.io', 
                                    accessPoint: 'DokApi',
                                    software: 'Dokapi (previously: Ixor Docs)'
                                },
                                { 
                                    contact: 'peppol@teamleader.eu', 
                                    accessPoint: 'Teamleader',
                                    software: null
                                },
                                { 
                                    contact: 'support@e-invoice.be', 
                                    accessPoint: 'e-invoice',
                                    software: 'e-invoice.be'
                                },
                                { 
                                    contact: 'support@onfact.be', 
                                    accessPoint: 'Infinwebs BV',
                                    software: 'OnFact'
                                },
                                { 
                                    contact: 'peppol.support@odoo.com', 
                                    accessPoint: 'Odoo',
                                    software: 'Odoo'
                                },
                                { 
                                    contact: 'support@okioki.be', 
                                    accessPoint: 'OkiOki',
                                    software: 'OkiOki'
                                },
                                { 
                                    contact: 'support@billit.com', 
                                    accessPoint: 'Billit',
                                    software: 'Billit'
                                },
                                { 
                                    contact: 'openpeppol@exact.com', 
                                    accessPoint: 'Exact',
                                    software: 'Exact Online'
                                },
                                { 
                                    contact: 'peppol@storecove.com', 
                                    accessPoint: 'Storecove',
                                    software: 'Accountable, Zenvoices, Lucy or Yuki'
                                },
                                { 
                                    contact: 'https://codabox.com', 
                                    accessPoint: 'Codabox',
                                    software: 'Doccle, Clearfacts or Eenvoudigfactureren.be'
                                }
                            ];

                            // Find matching contact mapping
                            const mapping = contactMappings.find(m => m.contact.toLowerCase() === t);
                            if (mapping) {
                                companyInfo.accessPointName = mapping.accessPoint;
                                if (mapping.software) {
                                    companyInfo.softwareProviders = mapping.software;
                                } else {
                                    companyInfo.softwareProviders = mapSoftwareProviders(
                                        t,
                                        mapping.accessPoint,
                                        companyInfo.documentTypes
                                    );
                                }
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
                if (companyInfo.technicalContact || companyInfo.accessPointName) break;
            }
        }
    } catch (e) {
        // Ignore errors in technical contact enrichment, continue showing base info
        console.warn('Technical contact enrichment failed:', e);
    }

    // Ensure we have the most accurate software providers and access point names
    if (companyInfo.accessPointName) {
        const unknown = (I18n?.t('unknown') || 'Unknown').toLowerCase();
        const apLower = String(companyInfo.accessPointName || '').toLowerCase();
        const current = String(companyInfo.softwareProviders || '').toLowerCase();

        // Consider providers generic if missing, Unknown, or equal to the AP name
        const providersLooksGeneric =
            !companyInfo.softwareProviders ||
            current === unknown ||
            (apLower && current === apLower);

        if (providersLooksGeneric) {
            companyInfo.softwareProviders = mapSoftwareProviders(companyInfo.technicalContact, companyInfo.accessPointName, companyInfo.documentTypes);
        }
    } else if (companyInfo.technicalContact) {
        // If we have a technical contact but no access point, try to derive it
        const mapped = mapSoftwareProviders(companyInfo.technicalContact, '', companyInfo.documentTypes);
        if (mapped && mapped !== 'Unknown') {
            companyInfo.softwareProviders = mapped;
            // For some providers, we can infer the access point from the software
            if (mapped === 'Mercurius') {
                companyInfo.accessPointName = 'Babelway';
            } else if (mapped.includes('Teamleader')) {
                companyInfo.accessPointName = 'Teamleader';
            } else if (mapped.includes('Odoo')) {
                companyInfo.accessPointName = 'Odoo';
            }
        }
    }
    
    // Final fallback to mapping function if we still don't have software providers
    if (!companyInfo.softwareProviders) {
        companyInfo.softwareProviders = mapSoftwareProviders(companyInfo.technicalContact, companyInfo.accessPointName, companyInfo.documentTypes);
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

        // Cross-scheme enrichment: ensure consistent mapping between 0208 and 9925 lookups
        try {
            // First normalize both lookups
            const normalize = (info) => {
                if (!info) return info;
                
                // Get access point name from SMP host URI if not already set
                if (!info.accessPointName && info.smpHostUri) {
                    info.accessPointName = getAccessPointNameFromSmpUri(info.smpHostUri);
                }
                
                // Country-specific tweak for Tradeshift generic host
                if (info.accessPointName === 'Tradeshift' && info.country === 'BE') {
                    info.accessPointName = 'Tradeshift Belgium';
                }
                
                // Only map software providers if not already enriched
                if (!info.softwareProviders) {
                    info.softwareProviders = mapSoftwareProviders(info.technicalContact, info.accessPointName, info.documentTypes);
                }
                
                return info;
            };
            
            // Normalize both lookups
            info0208 = normalize(info0208);
            info9925 = normalize(info9925);
            
            // If both lookups exist, ensure they share the same mapping
            if (info0208 && info9925) {
                // Intentionally do not copy/enrich across schemes: 0208 (KBO) and 9925 (VAT)
                // may legitimately point to different SMP/AP/technical contacts.
            }
        } catch (e) {
            console.error('Error during cross-scheme enrichment:', e);
            // Continue with the data we have
        }

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
    // Add warning icons to dot divs
    addWarningIcons();
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

    function autoLookupFromUrlOnce() {
        if (AUTO_LOOKUP_RAN) return;
        try {
            const path = (window.location && window.location.pathname) ? window.location.pathname : '';
            const match = path.match(/(?:^|\/)(BE\d{10}|\d{10})(?:[\/#?]|$)/i);
            if (match) {
                const numberMatch = match[1].toUpperCase();
                const normalized = numberMatch.replace(/^BE/, '');
                if (/^\d{10}$/.test(normalized)) {
                    const inputEl = document.getElementById('companyNumber');
                    if (inputEl) {
                        inputEl.value = `BE${normalized}`;
                        setTimeout(performLookup, 100);
                        // Mark as done only after we successfully scheduled a lookup
                        AUTO_LOOKUP_RAN = true;
                    }
                }
            }
        } catch (error) {
            console.error('Error processing URL for auto-lookup:', error);
        }
    }

    // Re-render results on language changes and try auto-lookup once when i18n is ready
    document.addEventListener('i18n:applied', () => {
        if (LAST_COMPANY_INFO) {
            if (LAST_COMPANY_INFO.info0208 && LAST_COMPANY_INFO.info9925) {
                displayCompanyInfoPair(LAST_COMPANY_INFO.info0208, LAST_COMPANY_INFO.info9925);
            }
        }
        autoLookupFromUrlOnce();
    });

    // Also attempt auto-lookup once on initial DOM ready
    autoLookupFromUrlOnce();
});

// Make performLookup available globally
window.performLookup = performLookup;
