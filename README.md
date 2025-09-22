# Peppol Network Lookup Website

A web application that allows users to lookup Belgian companies on the Peppol network using their VAT or entrepreneur numbers.

## Features

- 🔍 **Easy Lookup**: Simply enter a Belgian VAT or entrepreneur number
- 🏢 **Company Information**: Displays company name, location, and additional details
- 🔗 **Service Endpoints**: Shows all available Peppol service endpoints
- 👨‍💼 **Technical Contact**: Provides technical contact information when available
- ✅ **Network Status**: Confirms if the company is active in the Peppol network
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Supported Number Formats

- Belgian VAT numbers: `BE0123456789` or `0123456789`
- Belgian entrepreneur numbers: `0123456789`

## How It Works

The application uses the [Peppol Helger API](https://peppol.helger.com/api) to query the Peppol network:

1. **Existence Check**: Verifies if the company is registered in Peppol
2. **Business Card**: Retrieves company information and contact details
3. **Service Endpoints**: Gets all available document exchange endpoints

## API Integration

The app integrates with three main Peppol API endpoints:

- `/ppidexistence/{sml-id}/{participant-id}` - Check participant existence
- `/businesscard/{sml-id}/{participant-id}` - Get business card information
- `/smpquery/{sml-id}/{participant-id}` - Get service endpoints and document types

## Usage

1. Open `index.html` in a web browser
2. Enter a Belgian VAT or entrepreneur number
3. Click "Lookup" or press Enter
4. View the company information and service endpoints

## Technical Details

- **Frontend**: Pure HTML, CSS, and JavaScript (no frameworks required)
- **API**: Peppol Helger REST API
- **Participant ID Format**: `iso6523-actorid-upis::0208:{number}` (Belgian scheme)
- **SML**: Uses production Peppol SML (`digitprod`)

## Files Structure

```
peppol-lookup-website/
├── index.html          # Main HTML page
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## CORS Considerations

This application makes direct API calls to the Peppol Helger API. If you encounter CORS issues when running locally, you may need to:

1. Run a local web server instead of opening the file directly
2. Use a CORS proxy service
3. Deploy to a web server

## Example Companies for Testing

You can test the application with these Belgian companies (if they're registered in Peppol):

- Try searching for known Belgian companies with their VAT numbers
- Format: BE followed by 10 digits, or just the 10 digits

## Error Handling

The application handles various error scenarios:

- Invalid number format
- Company not found in Peppol network
- Network connectivity issues
- API service unavailability

## Browser Compatibility

- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge (latest versions)

## License

This project is open source and available under the MIT License.

## Credits

- Powered by [Peppol Helger API](https://peppol.helger.com)
- Created for Belgian Peppol network lookups
