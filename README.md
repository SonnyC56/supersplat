# SuperSplat Firebase Authentication

This document explains how the SuperSplat editor authenticates with Firebase and uploads edited models back to the original storage location.

## Overview

The StorySplat application passes a Firebase authentication token to the SuperSplat editor via URL parameters. This token is used by SuperSplat to authenticate with Firebase and upload edited models directly back to the original storage location.

## Authentication Flow

1. When a user clicks "Edit Splat" in StorySplat, the SuperSplatLauncher component:
   - Generates a Firebase ID token from the authenticated user
   - Extracts the original file path from the model URL
   - Passes these values to SuperSplat via URL parameters

2. SuperSplat then:
   - Extracts the authentication token and original path from URL parameters
   - Uses the token to authenticate with Firebase
   - When saving, uploads the edited model directly to the original path in Firebase Storage

## Implementation Details

### URL Parameters

SuperSplat receives the following parameters from StorySplat:

- `config`: Firebase configuration (JSON string)
- `userId`: The user's Firebase UID
- `authToken`: Firebase ID token for authentication
- `originalPath`: The original path of the file in Firebase Storage
- `load`: URL of the model to load
- `sceneId`: Optional scene ID

### Authentication

The `FirebaseStorageManager` class in `src/firebase/storage.ts` handles authentication with Firebase using the provided token. It uses the Firebase Auth REST API to authenticate with the ID token.

### File Upload

When saving a file with the "Save and Return" option, SuperSplat:

1. Uses the `FirebaseWriter` class to handle the upload
2. The writer uses the original path from URL parameters to overwrite the original file
3. After successful upload, it sends a postMessage to StorySplat with the new download URL

## Troubleshooting

If authentication or uploads fail, check the browser console for detailed error messages. Common issues include:

- Expired authentication token (tokens typically expire after 1 hour)
- Incorrect storage path
- Insufficient permissions in Firebase Storage rules

## Security Considerations

- The Firebase ID token is short-lived (typically 1 hour), providing good security
- Firebase Storage rules should be configured to allow authenticated users to write only to their own files
- Origin validation is implemented for postMessage communication
