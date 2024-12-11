# Kikori Canva Integration Design Document

## 1. Project Overview
### 1.1 Business Context
Kikori is an edtech company that creates experiential social-emotional learning activities for teachers. The heart of each activity is *teacher-facing* instructions about how to play it in their classroom. To help facilitate the activity, we are creating slide decks in Canva that include *student-facing* instructions about what to do. These slide decks are very successful, but time-consuming to make. It takes significant expertise and critical thought to write age-appropriate slides that follow our educational framework. In addition, the existing method of uploading slides into our activity database is unintuitive and error-prone, which prevents us from enlisting volunteer help.

Using the Canva Apps SDK, I will create an app that enables designers to do the following, entirely within the Canva interface they know and love:
- Generate a new age-appropriate slide deck for an activity automatically based on the teacher-facing instructions
- Modify an existing slide deck to target a different age group
- Link slide decks to their associated activity in the Kikori database

This is intended for general use by Kikori curriculum designers and should be usable without synchronous training. 

### 1.2 System Overview
The application consists of:
- **Frontend**: Canva app (React app built with Canva Apps SDK) with the features described above
- **Backend**: Express/Node.js server handling database operations and ChatGPT integration
- **Database**: Document-based MongoDB database for activities and Firebase store for static PDFs & thumbnails of slide decks
- **Database GUI**: Kikori Admin Panel, built using Flutter, to interact with the database; already built and tested

## 2. Data Architecture
### 2.1 MongoDB Schema
Activities are stored in the `activities` collection with the following structure:

```typescript
{
  _id: String,               // Unique _id field (note: not ObjectID)
  title: String,             // Display name of activity
  creator_id: String,        // User ID from Firebase
  activity_type: String,     // Either "original" (default) or "variation"
  slides?: {
    pdf: {
      name: String,          // Some identifying name for PDF; unused
      source: String,        // URL of PDF in Firebase
      thumbnail: String      // URL of PDF thumbnail in Firebase
    },
    slideUrl: String,        // Canva public view link
    editableSlideUrl: String // Canva template link
    collaborationUrl: String // Canva collaboration link
  },
  variation_of?: String,      // Parent activity ID if this is a variation
  last_updated_by?: String,   // .    .    .    .    .
  creation_time?: Number,     // Millis since Unix epoch
  last_edit?: Number,         // .    .    .    .    .   
  age_group?: [Number],       // Array of age groups from list below:
  // ["all ages", "PK-K", "1-2", "3-5", "MS", "MS", "??", "??"]
  // e.g. an activity targeting elementary would be [1, 2, 3]
  age_group_index?: Number    // Alternative format of age_group
  // index for example above would be 1.23
  variation?: String          // Description of variation (e.g. "Age group variation")
  instruction_source?: String // Description of source for original teacher-facing activity instructions
  ...many other properties    // e.g. tags, attributions, curriculum standards
}
```

Non-required fields are denoted with a question mark (?).

### 2.2 Data Relationships
Users can create variations of an activity to for various purposes:
- Target a different age group with the activity  
- Change the language
- Foster place-based learning by changing location-based details or metaphors used in explanations

When an activity is created using the "Make activity" interface in the Kikori admin panel, its `activity_type` field is set to `original`. If a variation is created using the "Make variation" interface, its `activity_type` is set to `variation` and its `variation_of` field is set to the `_id` field of the source activity. 

By default, `creator_id` is inherited from the source activity. If the user changes this, it is expected that the user attributes the activity properly using the `instruction_source` field.

**Known limitation:** there are *no restrictions* in the Kikori Admin Panel on what activity you can create a variation of. This can lead to unpredictable structures and behaviors, such as a variation that becomes "orphaned" if its parent activity is deleted, or a "variation of a variation" that is not easily traced back to the source. To avoid contributing this problem, __the Canva app will only allow auto-creating variations of activites with `activity_type="original"`.__ 

## 3. Application Components
### 3.1 Kikori Canva App (Frontend)
- **Technical Stack**: React, TypeScript, Canva Apps SDK
- **State Management**: React hooks (useState, useEffect)
- **Key Components**:
  - "Fetch Activity" button with associated text input to fetch an activity by ID from the Kikori database
  - "Generate Slides" button to generate a new slide deck
  - "Target Different Age Group" button to modify current slide deck to match different age group
  - Text inputs to gather shareable links (validated using regex); these are sadly not available via APIs
  - "Upload Slides to Kikori" button to link the current slide deck to the selected activity in Kikori
  - Dynamic informational alerts to facilitate intuitive user interaction throughout
- **Canva SDK Integration**:
  - All UI components are custom React elements provided by the Canva UI kit
  - Slide decks are created with calls to the Canva Apps API which provides comprehensive editing features
  - Note: The `addPage` endpoint, used to generate new slides, is rate limited to 3 calls per 10 seconds, so the app pauses for 4 seconds between creating slides and displays a loading bar

### 3.2 Kikori Slides App (Backend)
**Technical Stack**: Node.js, Express, MongoDB, Firebase
I'll provide a streamlined description of each API endpoint based on the `activityController.ts` file:

#### API Endpoints

1. **`POST /fetchActivity`**
   - **Purpose**: Retrieves detailed activity data for a specific activity
   - **Request Body**: 
     - `activityId`: Activity `_id`
   - **Responses**:
     - `200 OK`: Returns complete activity data

2. **`POST /generateSlides`**
   - **Purpose**: Generates a new slide deck for an activity using ChatGPT. 
   - **Request Body**:
     - `activityId`: Activity `_id`
     - `gradeLevelString`: Target grade level (e.g. "PK-K") for slide content
   - **Requirements**:
     - Activity must have complete data (title, description, playing, learning)
   - **Responses**:
     - `200 OK`: Returns generated slide deck

3. **`POST /uploadPdf`**
   - **Purpose**: Uploads a PDF slide deck to Firebase storage and returns links to store in MongoDB database for easy access.
   - **Request Body**:
     - `activityId`: Unique identifier for the activity
     - `activityName`: Name of the activity; used to generate PDF name
     - `exportBlobUrl`: Temporary URL of the PDF export (provided by Canva)
   - **Responses**:
     - `200 OK`: Returns PDF and thumbnail Firebase URLs

4. **`POST /createVariation`**
   - **Purpose**: Creates a new variation of an existing activity.
   - **Request Body**:
     - `activityId`: Unique identifier for the base activity
     - `ageGroup`: Target age ranges (0-8)
     - `userID`: Creator's user identifier
     - `variation`: Variation description
     - `inheritCreatorID`: Whether to inherit original creator's ID
     - `slides`: 
       - Public view link
       - Collaboration link
       - Template link
       - PDF details (name, source, thumbnail)
   - **Responses**:
     - `201 Created`: Variation successfully created

5. **`POST /updateSlides`**
   - **Purpose**: Update existing activity's slide links and PDF information.
   - **Request Body**:
     - `activityId`: Unique identifier for the activity
     - `userID`: User performing the update
     - `slides`:
       - New slide view URL
       - Editable slide URL
       - Collaboration URL
       - PDF details (name, source, thumbnail)
   - **Responses**:
     - `200 OK`: Slides successfully updated

Each endpoint includes comprehensive input validation and provides detailed error responses to help diagnose and resolve issues during API interactions. 

**Error Handling**: All endpoints can return a `400 Bad Request` for bad inputs or `500 Internal Server Error` for unexpected server-side errors, and endpoints that take an activity `_id` can return `404 Not Found` if that is not a valid `_id`.

## 4. Expected Workflows
### 4.1 Open App and Select Activity
1. User starts Canva app.
 - If the app is not opened to a valid Kikori template, most of the app is hidden and the user is instructed to open a 

### 4.1 Create a Variation
1. User enters activity ID, selects grade level, and enters links
2. Backend validates that there is no existing variation for that grade
3. New activity document created with:
   - All fields shown in section 2.1 will be updated appropriately
4. Returns new activity ID or error message to frontend

### 4.2 Slide Generation
ChatGPT Integration:
1. Frontend sends validated activity to generateSlides endpoint
2. Backend queries ChatGPT using a system prompt and activity text and receives slides
3. Backend sends fully formatted slides to frontend and frontend generates slides, with delays to accomodate rate limiting
4. User edits slides using their expertise

Error scenarios:
- Invalid activity ID
- Duplicate grade level variation
- Invalid Canva links
- ChatGPT generation failures
- Other database errors (full messages sent to log)

## 5. Development Environment
### 5.1 Local Setup
System requirements: Follow instructions [at this link](https://www.canva.dev/docs/apps/prerequisites/)

Create an app in the [Apps](https://www.canva.com/developers/apps) page, copy its ID to the `CANVA_APP_ID` variable in `app.tsx`, click the Preview button in the Apps page for your app, and run `npm start` in the `kikori-canva-app` directory to use the app.

### 5.2 Testing Strategy
To be written!