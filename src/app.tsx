// general imports
import { useState, useEffect } from "react";
import * as styles from "styles/components.css";

// canva SDK imports
import {
  Button, Rows, Title, Text, FormField, TextInput, CheckboxGroup, SegmentedControl, Alert, Badge, ProgressBar, Switch, Box
} from "@canva/app-ui-kit";
import { addPage, getCurrentPageContext, requestExport } from "@canva/design";
import { getTemporaryUrl } from "@canva/asset";


/* GLOBALS; REVIEW BEFORE DEPLOYING */
const API_URL = "https://kikori-slides-api-08c1d2c0a600.herokuapp.com"; // Heroku API for database querying and ChatGPT calls
// const DEFAULT_ID = "66a16fe0a17a5ac6a7936c5d" // from sandbox database, parent variation
const DEFAULT_ID = "";
// const DEFAULT_ID = "6NyRnQ4h0mqQne3KE1Nm" // from LIVE database
// const DEFAULT_ID = "66deb0c59cb7a67d18c1ef29" // from sandbox database, test activity with one age group
const INHERIT_CREATOR_ID_DEFAULT = true; // default creator ID for variations; chassenathan for now
const VARIATION_DESCRIPTION_DEFAULT = "Age group variation"; // default description for variations
const USER_ID_DEFAULT = "GEvIbLpTT4hgw135BioFr9njDGB2"; // default user ID for updating slides; chassenathan for now


// helper function to validate links and determine their type
type CanvaLinkType = 'collaboration' | 'public view' | 'template' | 'unknown';
function identifyCanvaLinkType(url: string): CanvaLinkType {
  if (/\/edit\?/.test(url)) {
    return 'collaboration';
  } else if (/\/view\?.*mode=preview/.test(url)) {
    return 'template';
  } else if (/\/view\?(?!.*mode=preview)/.test(url)) {
    return 'public view';
  } else {
    return 'unknown';
  }
}

// available grade levels to select with the SegmentedSelect
const gradeLevelSelectorOptions = [
  { label: 'PK-K', value: 1 },
  { label: '1-2', value: 2 },
  { label: '3-5', value: 3 },
  //{ label: 'MS', value: 4 },
  //{ label: 'HS', value: 5 }
];
const gradeLevels = ["all", "PK-K", "1-2", "3-5", "MS", "HS", "Higher Ed", "Workforce/PD"]; // for accessing grade level to display by index

// helper function to call API to generate slides for given activity and grade level
// activityId is just the activity id string, gradeLevel is something from the grade level list
async function generateSlides(activityId: string, gradeLevel: string) {
  const response = await fetch(API_URL + '/generateSlides', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ activityId, gradeLevel }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate slides');
  }

  return await response.json();
}

// properties that all activities found in the database MUST have (otherwise error is thrown)
// errors to the console and returns false 
const requiredActivityData = [
  { key: "title", isValid: (value: any) => typeof value === "string" && value.trim() !== "", error: "title must not be empty." },
  { key: "age_group", isValid: (value: any) => Array.isArray(value), error: "age_group must be a list of numbers." }
];

// function to check the properties of an object
function validateActivityData(activityData): boolean {
  const errors: string[] = [];

  requiredActivityData.forEach(({ key, isValid, error }) => {
    if (!(key in activityData)) {
      errors.push(`Missing property: ${key}`);
    } else if (!isValid(activityData[key])) {
      errors.push(error);
    }
  });

  if (errors.length > 0) {
    console.error(`Activity data for activity with ID ${activityData._id} has the following problems:`, errors.join(" | "));
    return false
  } else {
    return true
  }
}

/**
 * Helper function to process and upload a PDF of the input activity.
 * 
 * @param activityId - The ID of the activity.
 * @param pdfName - The name of the activity.
 * @returns An object containing the upload status (completed/aborted) and, if completed, PDF's details (`pdfName`, `pdfUrl`, `thumbnailUrl`).
 */
async function uploadPdf(activityId: string, pdfName: string, canvaExportBlobUrl: string) {
  try {
    const uploadPdfResponse = await fetch(`${API_URL}/uploadPdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdfUrl: canvaExportBlobUrl,
        activityId,
        pdfName
      }),
    });

    if (!uploadPdfResponse.ok) {
      const errorData = await uploadPdfResponse.json();
      throw new Error(`Error uploading PDF: ${errorData?.message ?? "Unknown error"}`);
    }

    const pdfData = await uploadPdfResponse.json();
    console.log("PDF uploaded successfully:", pdfData);

    // Return the uploaded PDF details
    return {
      status: "completed",
      pdfUrl: pdfData.pdfUrl,
      thumbnailUrl: pdfData.thumbnailUrl,
    };
  } catch (error) {
    console.error("Error in processAndUploadPdf:", error);
    throw error; // Re-throw the error so the caller can handle it
  }
}

// Kikori's selected font for the slide titles
const FONTS = {
  "Wedges": "YAEKEi3zNJo:0"
};

// used to draw the white rectangle containing text on content slides. uses Canva's weird shape drawing syntax
const createRoundedRectPath = (width: number, height: number, radius: number) =>
  `M ${radius} 0 H ${width - radius} A ${radius} ${radius} 0 0 1 ${width} ${radius} V ${height - radius} A ${radius} ${radius} 0 0 1 ${width - radius} ${height} H ${radius} A ${radius} ${radius} 0 0 1 0 ${height - radius} V ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0 Z`;

// helper function to add a Kikori-formatted content slide with input title and content
async function addPageHelper(title: string, content: string) {
  const context = await getCurrentPageContext();
  const height = context.dimensions.height;
  const width = context.dimensions.width;

  // rm = rect_margin, cm = content_margin, tm = title_margin
  const rm_x = 163.36;
  const rm_top = 286.2;
  const rm_bottom = 85.4;
  const rect_width = width - 2 * rm_x;
  const rect_height = height - rm_top - rm_bottom;
  const rect_rounding = 34;

  const cm_x = 100;
  const cm_top = 100;

  const tm_top = 93;

  const logo_ref = "MAGSXRuIsBQ:1"; // reference to an SVG of the Kikori logo (to put in the top left)

  addPage({
    "elements": [
      {
        "type": "group",
        "children": [
          {
            "type": "shape",
            "paths": [
              {
                "d": createRoundedRectPath(width - 2 * rm_x, height - rm_top - rm_bottom, 34),
                "fill": {
                  "color": "#FFFFFF",
                  "dropTarget": false
                },
              },
            ],
            "viewBox": {
              "top": 0,
              "left": 0,
              "height": height - rm_top - rm_bottom,
              "width": width - 2 * rm_x
            },
            "top": 0,
            "left": 0,
            "height": height - rm_top - rm_bottom,
            "width": width - 2 * rm_x
          },
          {
            "type": "text",
            "children": [content],
            "left": cm_x,
            "width": width - 2 * rm_x - 2 * cm_x,
            "top": cm_top,
            "fontSize": 50
          }
        ],
        "top": rm_top,
        "left": rm_x,
        "height": height - rm_top - rm_bottom,
        "width": "auto"
      },
      {
        "type": "text",
        "children": [title],
        "left": width / 4,
        "width": width / 2,
        "top": tm_top,
        "fontSize": 140,
        "fontRef": FONTS["Wedges"],
        "color": "#FFFFFF",
        "textAlign": "center"
      },
      {
        "type": "image",
        "altText": { "text": "Kikori logo" },
        "ref": logo_ref,
        "top": 57,
        "left": 64,
        "height": 65,
        "width": "auto"
      }
    ]
  })
}

export const App = () => {

  /* state variables for various app elements */

  // INPUTS
  const [activityIdInput, setActivityIdInput] = useState(""); // for tracking activity ID input
  const [activityIdInputDisabled, setActivityIdInputDisabled] = useState(false); // for enabling/disabling input field
  const [selectedAgeGroupIndex, setSelectedAgeGroupIndex] = useState(-1); // grade level segmented selector
  const [collaborationLink, setCollaborationLink] = useState(""); // collaboration link text field
  const [templateLink, setTemplateLink] = useState(""); // brand template link text field
  const [publicViewLink, setPublicViewLink] = useState(""); // public link text field

  // BUTTONS
  // messages
  const VERIFY_BUTTON_NO_ACTIVITY_SELECTED_MESSAGE = "Fetch Activity by ID";
  const VERIFY_BUTTON_ACTIVITY_SELECTED_MESSAGE = "Use other activity";
  const CREATE_VARIATION_BUTTON_DEFAULT_MESSAGE = "Create variation";
  const CREATE_VARIATION_BUTTON_ACTIVITY_SELECTED_DEFAULT_MESSAGE = "Create variation for selected activity";
  const UPDATE_SLIDES_BUTTON_DEFAULT_MESSAGE = "Update slide links";
  const UPDATE_SLIDES_BUTTON_ACTIVITY_SELECTED_MESSAGE = "Update slide links";

  // states
  const [verifyActivityIdButton, setVerifyActivityIdButton] = useState({ variant: "primary", text: "Fetch Activity by ID", disabled: false, loading: false })
  const [generateSlidesButton, setGenerateSlidesButton] = useState({ disabled: true, message: "Generate slides", loading: false }); // for enabling/disabling generate slides button
  const [createVariationButton, setCreateVariationButton] = useState({ disabled: false, message: CREATE_VARIATION_BUTTON_DEFAULT_MESSAGE, loading: false }); // create variation button state
  const [updateSlidesButton, setUpdateSlidesButton] = useState({ disabled: true, message: UPDATE_SLIDES_BUTTON_DEFAULT_MESSAGE, loading: false }); // update slide links button state

  // COMPUTED STATES
  type Activity = { _id: string; age_group: number[]; title: string; };
  const [selectedActivity, setSelectedActivity] = useState<Activity>({ _id: "", age_group: [], title: "" }); // set when activity is verified
  const [isActivitySelected, setIsActivitySelected] = useState(false); // used to disable activity ID input
  const [slideGenerationInProgress, setSlideGenerationInProgress] = useState(false); // used to render progress bar
  const [slideGenerationProgressValue, setSlideGenerationProgressValue] = useState(0); // progress of progress bar
  const [interactingWithDatabase, setInteractingWithDatabase] = useState(false); // to disable buttons while interacting with database
  const [waitingForPdfExport, setWaitingForPdfExport] = useState(false); // true while waiting for the user to click the export PDF button
  const [pdfExportInProgress, setPdfExportInProgress] = useState(false); // true for like .8 seconds when Canva is exporting the PDF

  // ALERTS
  // messages
  const SELECT_ACTIVITY_FIRST_MESSAGE = "Select an activity first! Scroll to the top.";
  const SELECT_GRADE_LEVEL_GENERATE_MESSAGE = "Select a grade level first. This is used to generate age-appropriate slides.";

  // states
  const [verifyAlert, setVerifyAlert] = useState({ visible: false, message: "", tone: "warn" }); // verifying ID alert
  const [generatingAlert, setGeneratingAlert] = useState({ visible: false, message: "Generating...", tone: "neutral" }); // generating slides alert
  // persistent informational alert below the slides button explaining how to use it
  const [slidesButtonInfoAlert, setSlidesButtonInfoAlert] = useState({ visible: true, message: SELECT_ACTIVITY_FIRST_MESSAGE });
  const [collaborationLinkAlert, setCollaborationLinkAlert] = useState({ visible: false, message: "", tone: "warn" }); // collaboration link validatoin
  const [templateLinkAlert, setTemplateLinkAlert] = useState({ visible: false, message: "", tone: "warn" }); // brand template link validation
  const [publicLinkAlert, setPublicLinkAlert] = useState({ visible: false, message: "", tone: "warn" }); // public link validation
  const [createVariationInfoAlert, setCreateVariationInfoAlert] = useState({ visible: true, message: SELECT_ACTIVITY_FIRST_MESSAGE, tone: "warn" }); // info for create variation button
  const [createVariationResultAlert, setCreateVariationResultAlert] = useState({ visible: false, message: "", tone: "" }); // show result of createVariation persistently
  const [updateSlidesInfoAlert, setUpdateSlidesInfoAlert] = useState({ visible: true, tone: "warn", message: SELECT_ACTIVITY_FIRST_MESSAGE }); // info for update slides button
  const [updateSlidesResultAlert, setUpdateSlidesResultAlert] = useState({ visible: false, tone: "neutral", message: "" }); // show result of updateActivitySlides persistently

  // HELPER; used whenever a button is pressed for clarity
  async function disableAllResultAlerts() {
    setVerifyAlert({ visible: false, message: "", tone: "warn" });
    setUpdateSlidesResultAlert({ visible: false, message: "", tone: "" });
    setUpdateSlidesInfoAlert({ visible: false, message: "", tone: "warn" });
    setWaitingForPdfExport(false);
    setCreateVariationResultAlert({ visible: false, message: "", tone: "" });
    setGeneratingAlert({ visible: false, message: "", tone: "" });
  }


  /* HANDLERS for app element interaction */

  // handler for "Verify activity ID" button
  async function handleVerifyActivityID() {
    disableAllResultAlerts(); // clear any existing alerts
    setInteractingWithDatabase(true); // disable normal button and alert updates

    // if no activity is selected currently, this button searches for a new one based on activity ID text input
    if (!isActivitySelected) {

      // fetch the ID using the backend
      const activityId = activityIdInput;
      const response = await fetch(API_URL + '/fetchActivity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activityId })
      });

      // check the HTTP response
      if (!response.ok) {
        setVerifyAlert({ visible: true, message: "No activity with that ID", tone: "warn" });
        setVerifyActivityIdButton((prevState) => ({ ...prevState, disabled: false })); // re-enable without changing button

        // process the response
      } else {
        const activity = await response.json();
        const data = activity.activityData;
        console.log("fetched activity with id " + activityIdInput + ": " + JSON.stringify(activity));

        // make sure activity data contains all required properties first (at least title and age_group for now)
        if (!validateActivityData(data)) {
          setVerifyAlert({ visible: true, message: "Important activity data is missing or invalid; see console", tone: "warn" });
          setVerifyActivityIdButton((prevState) => ({ ...prevState, disabled: false }));

          // activity verified; update things
        } else {
          setIsActivitySelected(true); // lock the activity ID input
          setVerifyAlert({ visible: true, message: `Activity found!`, tone: "positive" }); // alert
          setSelectedActivity({ _id: data._id, age_group: data.age_group, title: data.title }); // save some activity for other things to reference
        }
      }

      // if an activity is currently selected, this button resets the selected activity which affects other things via useEffects
    } else {
      setIsActivitySelected(false); // unlock the activity ID input
      setSelectedActivity({ _id: "", age_group: [], title: "" }); // reset activity selection to blank values for sanity
    }

    setInteractingWithDatabase(false); // re-enable button and alert updates
  }

  // handler for "Generate Slides" button
  async function handleGenerateSlidesButton() {
    try {
      disableAllResultAlerts(); // clear any existing alerts
      setGeneratingAlert({ visible: true, message: "Connecting to ChatGPT...", tone: "neutral" });
      setSlideGenerationInProgress(true);
      setSlideGenerationProgressValue(0);

      const sel_cycle = ["play", "reflect", "connect", "grow"];
      const response = await generateSlides(selectedActivity._id, gradeLevels[selectedAgeGroupIndex]);

      if (!response || !response["slides"]) {
        throw new Error("Invalid response format from generateSlides: " + JSON.stringify(response));
      }

      setGeneratingAlert({ visible: true, message: "Generating slides...", tone: "neutral" });
      setSlideGenerationProgressValue(25);

      const deck = response.slides[0];
      console.log("Response: " + JSON.stringify(response));
      console.log("Deck: " + JSON.stringify(deck));

      // Calculate total slide count for progress tracking
      const totalSlides = sel_cycle.reduce((count, section) => count + (deck[section]?.length || 0), 0);
      let completedSlides = 0;

      for (const section of sel_cycle) {
        console.log(section);
        const slides = deck[section];
        if (!slides) continue; // Skip if section has no slides

        for (const slideContent of slides) {
          await addPageHelper(section, slideContent);
          completedSlides += 1;

          // Update progress based on completed slides
          setSlideGenerationProgressValue(Math.min(100, Math.floor(25 + (completedSlides / totalSlides) * 75)));

          // Delay to simulate slide generation time (API only allows 3 page adds per 10 seconds)
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }

      setSlideGenerationProgressValue(100);
      setGeneratingAlert({ visible: true, message: "Slides generated!", tone: "positive" });

    } catch (error) {
      console.error("Error generating slides:", error);
      setGeneratingAlert({ visible: true, message: "Error generating slides. Please try again.", tone: "warn" });
    } finally {
      setSlideGenerationInProgress(false);
      setSlideGenerationProgressValue(0);
    }
  }

  async function handleExportPDFButton() {
    try {
      // Step 1: request a PDF export from Canva 
      // this opens up a menu for the user to select export options)
      // the user can cancel the export, in which case the exportBlob will have a status of "aborted"
      setWaitingForPdfExport(false);
      setPdfExportInProgress(true);

      const exportBlob = await requestExport({ acceptedFileTypes: ["pdf_standard"] });
      if (exportBlob.status === "aborted") {
        setUpdateSlidesResultAlert({
          visible: true,
          tone: "warn",
          message: "PDF export cancelled. No updates were made. If this was a mistake, be sure to select \"Flatten PDF\" and then click \"Export\" when the PDF export menu appears.",
        });
        return;
      }

      setPdfExportInProgress(false);
      setInteractingWithDatabase(true); // disable normal button and alert updates

      // Step 2: prepare to upload the PDF to the Kikori database
      const canvaExportBlobUrl = exportBlob.exportBlobs[0].url; // extract url from exportBlob
      const pdfName = selectedActivity.title;
      const pdfData = await uploadPdf(selectedActivity._id, pdfName, canvaExportBlobUrl);

      const requestBody = {
        activityId: selectedActivity._id,
        userID: USER_ID_DEFAULT,
        slides: {
          pdf: {
            name: pdfName,
            source: pdfData.pdfUrl,
            thumbnail: pdfData.thumbnailUrl,
          },
          slideUrl: publicViewLink,
          editableSlideUrl: templateLink,
          collaborationUrl: collaborationLink,
        },
      };

      setUpdateSlidesInfoAlert({
        visible: true,
        tone: "neutral",
        message: "Updating slides in the Kikori database...",
      });

      // Step 3: make the API call to do the upload
      const response = await fetch(`${API_URL}/updateActivitySlides`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating activity:", errorData);
        setUpdateSlidesResultAlert({
          visible: true,
          tone: "warn",
          message: `Error updating slides: ${errorData?.error?.message ?? "Unknown error"}`,
        });
        return;
      }

      const result = await response.json();
      console.log("Slides updated successfully:", result);

      // Show success alert
      setUpdateSlidesResultAlert({
        visible: true,
        tone: "positive",
        message: "Slides updated successfully!",
      });
    } catch (error) {
      console.error("Unexpected error updating slides:", error);

      // Show error alert
      setUpdateSlidesResultAlert({
        visible: true,
        tone: "warn",
        message: "An unexpected error occurred while updating slides. Please try again.",
      });
    } finally {
      setWaitingForPdfExport(false);
      setInteractingWithDatabase(false);
    }
  }

  // handler for create variation button
  async function handleCreateVariationButton() {
    setInteractingWithDatabase(true); // disable normal button and alert updates
    disableAllResultAlerts(); // clear any existing alerts
    setCreateVariationInfoAlert({ visible: false, message: "", tone: "neutral" });

    try {
      // Show an alert that the update process has started
      setCreateVariationInfoAlert({
        visible: true,
        tone: "neutral",
        message: "Exporting PDF...",
      });

      const pdfData = await uploadPdf(selectedActivity._id, selectedActivity.title, "test.url");
      console.log("PDF uploaded successfully:", pdfData);

      // Step 2: Use the uploaded PDF details to create the variation
      const requestBody = {
        activityId: selectedActivity._id,
        ageGroup: [selectedAgeGroupIndex],
        userID: USER_ID_DEFAULT,
        inheritCreatorID: INHERIT_CREATOR_ID_DEFAULT,
        variation: VARIATION_DESCRIPTION_DEFAULT,
        slides: {
          publicViewLink: publicViewLink,
          collaborationLink: collaborationLink,
          templateLink: templateLink,
          pdf: {
            name: selectedActivity.title, // FIX THIS
            source: pdfData.pdfUrl,
            thumbnail: pdfData.thumbnailUrl,
          },
        },
      };

      const response = await fetch(`${API_URL}/createVariation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        setCreateVariationResultAlert({
          visible: true,
          tone: "warn",
          message: `Error creating variation: ${errorData?.errors?.join(", ") ?? "Unknown error"}`
        });
        console.error("Error creating variation:", errorData);
      } else {
        const responseData = await response.json();
        setCreateVariationResultAlert({
          visible: true,
          tone: "positive",
          message: "Variation created successfully!"
        });
        console.log("Variation created successfully:", responseData);
      }
    } catch (error) {
      console.error("Unexpected error in handleCreateVariationButton:", error);
      setCreateVariationResultAlert({
        visible: true,
        tone: "warn",
        message: "Unexpected error occurred while creating variation. See logs."
      });
    } finally {
      setInteractingWithDatabase(false); // re-enable button and alert updates
    }
  }

  /* HELPFUL CODE WHILE DEVELOPING
  // for exploring the openDesign function in Canva SDK
  async function handleOpenDesign(draft, helpers) {
    console.log(draft);
    console.log(helpers);
  }
 
  // print all elements on the page using the openDesign function (also for getting my bearings)
  async function printElementsButton() {
    openDesign({ type: "current_page" }, async (draft, { elementBuilder }) => {
      draft.page.elements.forEach((element, index) => {
        console.log(index, element);
      });
 
      if (draft.page.type !== "fixed") {
        console.log("skipping");
        return;
      }
 
      // Inserting a new rectangle element using list methods
      const newRect = elementBuilder.createRectElement({
        stroke: {"weight": 1, "color": {"type": "solid", "color": "#FFFFFF"}},
        top: 100,
        left: 100,
        width: 150,
        height: 100,
        fill: {
          color: {
            type: "solid",
            color: "#ff0000",
          },
        },
      });
      console.log("adding rectangle");
  
      // Insert the new rectangle at the end of the elements list
      draft.page.elements.insertAfter(undefined, newRect);
  
      return await draft.save();
      
    });
  }
 
  // print the element that was just clicked and some details about it
  async function handleClick() {
    if (!isElementSelected) {
      console.log("no element selected");
      return;
    }
 
    const draft = await currentSelection.read();
 
    for (const content of draft.contents) {
      const { url } = await getTemporaryUrl({
        type: "image",
        ref: content.ref,
      });
      console.log(url);
    }
  }
 
  // placeholder
  async function handleNothingClick() {
    console.log("nothing click");
  }
  */


  /* useEffects for complex input changes (e.g. link validation and changing button states on interactions with inputs) */

  // Template Link Effects
  useEffect(() => {
    if (!templateLink) {
      setTemplateLinkAlert({ visible: false, message: "", tone: "warn" });
    }

    const linkType = identifyCanvaLinkType(templateLink);

    if (linkType === 'template') {
      setTemplateLinkAlert({ visible: true, message: "Link valid!", tone: "positive" });
      const timer = setTimeout(() => setTemplateLinkAlert({ visible: false, message: "", tone: "warn" }), 3000);
      return () => clearTimeout(timer);
    } else if (linkType !== 'unknown') {
      setTemplateLinkAlert({ visible: true, message: `You entered a ${linkType} link. Please enter a template link.`, tone: "warn" });
    }
  }, [templateLink]);

  // Collaboration Link Effects
  useEffect(() => {
    if (!collaborationLink) {
      setCollaborationLinkAlert({ visible: false, message: "", tone: "warn" });
    }

    const linkType = identifyCanvaLinkType(collaborationLink);
    if (linkType === 'collaboration') {
      setCollaborationLinkAlert({ visible: true, message: "Link valid!", tone: "positive" });
      const timer = setTimeout(() => setCollaborationLinkAlert({ visible: false, message: "", tone: "warn" }), 3000);
      return () => clearTimeout(timer);
    } else if (linkType !== 'unknown') {
      setCollaborationLinkAlert({ visible: true, message: `You entered a ${linkType} link. Please enter a collaboration link.`, tone: "warn" })
    };
  }, [collaborationLink]);

  // Public view link effects
  useEffect(() => {
    if (!publicViewLink) {
      setPublicLinkAlert({ visible: false, message: "", tone: "warn" });
    }

    const linkType = identifyCanvaLinkType(publicViewLink);
    if (linkType === 'public view') {
      setPublicLinkAlert({ visible: true, message: "Link valid!", tone: "positive" });
      const timer = setTimeout(() => setPublicLinkAlert({ visible: false, message: "", tone: "warn" }), 3000);
      return () => clearTimeout(timer);
    } else if (linkType !== 'unknown') {
      setPublicLinkAlert({ visible: true, message: `You entered a ${linkType} link. Please enter a public view link.`, tone: "warn" })
    };
  }, [publicViewLink]);

  // Effect to update alert states and button states based on input changes
  // While interacting with the database or generating slides, simply disable all buttons
  //
  // Alerts are NOT modified by this effect while interacting with the database or generating slides;
  // in that case, they are set synchronously by the functions that interact with the database
  useEffect(() => {
    if (slideGenerationInProgress) {
      setSlidesButtonInfoAlert({ visible: true, message: "If you interact with Canva while slides are generating, they may generate out of order." });
    }

    if (interactingWithDatabase || slideGenerationInProgress) {
      setVerifyActivityIdButton({ disabled: true, variant: "secondary", text: "Talking to Kikori backend...", loading: true });
      setUpdateSlidesButton({ disabled: true, message: "Talking to Kikori backend...", loading: true });
      setCreateVariationButton({ disabled: true, message: "Talking to Kikori backend...", loading: true });
      setGenerateSlidesButton({ disabled: true, message: "Talking to Kikori backend...", loading: true });
      return
    }; // disable all buttons if interacting with database or generating slides; alerts handled elsewhere

    // verify activity ID button and input logic
    if (isActivitySelected) {
      setActivityIdInputDisabled(true);
      setVerifyActivityIdButton({ variant: "secondary", disabled: false, text: VERIFY_BUTTON_ACTIVITY_SELECTED_MESSAGE, loading: false });
    } else {
      setActivityIdInputDisabled(false);
      setVerifyActivityIdButton({ variant: "primary", disabled: false, text: VERIFY_BUTTON_NO_ACTIVITY_SELECTED_MESSAGE, loading: false });
    }

    const multipleGradesInSelectedActivity = selectedActivity.age_group.length > 1;
    const linksValid = identifyCanvaLinkType(collaborationLink) === 'collaboration' &&
      identifyCanvaLinkType(templateLink) === 'template' &&
      identifyCanvaLinkType(publicViewLink) === 'public view';

    // Update activity button logic
    if (waitingForPdfExport) {
      setUpdateSlidesInfoAlert({ visible: true, message: "Waiting for user to export PDF...", tone: "neutral" });
      setUpdateSlidesButton({ disabled: true, message: "Waiting for export", loading: true });
    } else if (pdfExportInProgress) {
      setUpdateSlidesInfoAlert({ visible: true, message: "Waiting for Canva to export PDF...", tone: "neutral" });
      setUpdateSlidesButton({ disabled: true, message: "Exporting PDF...", loading: true });
    } else {
      if (!isActivitySelected) {
        setUpdateSlidesInfoAlert({ visible: true, message: SELECT_ACTIVITY_FIRST_MESSAGE, tone: "warn" });
        setUpdateSlidesButton({ disabled: true, message: UPDATE_SLIDES_BUTTON_DEFAULT_MESSAGE, loading: false });
      } else if (!linksValid) {
        setUpdateSlidesInfoAlert({ visible: true, message: "Copy links from the \"Share\" menu into the text boxes above to update activity.", tone: "warn" });
        setUpdateSlidesButton({ disabled: true, message: UPDATE_SLIDES_BUTTON_DEFAULT_MESSAGE, loading: false });
      } else {
        setUpdateSlidesInfoAlert({ visible: false, message: "", tone: "warn" });
        setUpdateSlidesButton({ disabled: false, message: UPDATE_SLIDES_BUTTON_ACTIVITY_SELECTED_MESSAGE, loading: false });
      }
    }

    // Create variation and update activity slides logic
    if (!isActivitySelected) {
      setCreateVariationInfoAlert({ visible: true, message: SELECT_ACTIVITY_FIRST_MESSAGE, tone: "warn" });
      setCreateVariationButton({ disabled: true, message: CREATE_VARIATION_BUTTON_DEFAULT_MESSAGE, loading: false });

    } else if (!linksValid) {
      setCreateVariationInfoAlert({ visible: true, message: "Enter valid slide links to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: `Create variation for ${gradeLevels[selectedAgeGroupIndex]}`, loading: false });

    } else if (!multipleGradesInSelectedActivity) {
      setCreateVariationInfoAlert({ visible: true, message: "The selected activity only has one age group. Find the parent activity to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: CREATE_VARIATION_BUTTON_DEFAULT_MESSAGE, loading: false });
    } else if (selectedAgeGroupIndex == -1) {
      setCreateVariationInfoAlert({ visible: true, message: "Select a grade level to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: CREATE_VARIATION_BUTTON_ACTIVITY_SELECTED_DEFAULT_MESSAGE, loading: false });
    } else {
      setCreateVariationInfoAlert({ visible: false, message: "", tone: "warn" });
      setCreateVariationButton({ disabled: false, message: `Create variation for ${gradeLevels[selectedAgeGroupIndex]}`, loading: false });

    }

    // Generate slides logic
    if (!slideGenerationInProgress) {
      if (!isActivitySelected) {
        setGenerateSlidesButton({ disabled: true, message: "Generate slides", loading: false });
        setSlidesButtonInfoAlert({ visible: true, message: SELECT_ACTIVITY_FIRST_MESSAGE });
      } else if (selectedAgeGroupIndex == -1) {
        setGenerateSlidesButton({ disabled: true, message: "Generate slides for selected activity", loading: false });
        setSlidesButtonInfoAlert({ visible: true, message: SELECT_GRADE_LEVEL_GENERATE_MESSAGE });
      } else {
        setGenerateSlidesButton({ disabled: false, message: `Generate slides for ${gradeLevels[selectedAgeGroupIndex]}`, loading: false });
        setSlidesButtonInfoAlert({ visible: false, message: "If you interact with Canva while slides are generating, they may generate out of order." });
      }
    }

  }, [isActivitySelected, selectedAgeGroupIndex, selectedActivity, publicViewLink, collaborationLink, templateLink, interactingWithDatabase, slideGenerationInProgress, waitingForPdfExport]);

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">

        <Title
          alignment="start"
          capitalization="default"
          size="large"
        >
          Kikori Canva Helper
        </Title>

        {/* App Description Box */}
        <Box background="neutralLow" borderRadius="large" padding="2u">
          <Text size="large" variant="bold">
            In this app, you can:
          </Text>
          <CheckboxGroup defaultValue={["generate", "update"]}
            options={[
              {
                label: 'Generate age-appropriate slides based on activity instructions',
                value: 'generate'
              },
              {
                label: 'Update the slides field of an existing activity in the Kikori database',
                value: 'update'
              },/*
              {
                label: 'Create a variation of an activity with new slides in the Kikori database',
                value: 'create',
              }*/
            ]}
          />
        </Box>



        {/* Activity ID Input Area */}
        <Text variant="bold" tone="tertiary">Copy an activity ID from the Kikori app or admin panel to get started!</Text>

        <FormField
          control={(props) => <TextInput
            name="Activity ID Input"
            disabled={activityIdInputDisabled}
            placeholder="Copy activity ID from Kikori app"
            defaultValue={DEFAULT_ID}
            onChange={setActivityIdInput} {...props}
          />}
          label="Select Activity"
          description="This will fetch the activity with the given ID from the Kikori database so Canva can interact with it."
        />

        <>
          {selectedActivity._id != "" && (
            <Text>
              {selectedActivity.age_group.map((age_group_index, _) => <Badge
                key={age_group_index}
                ariaLabel="selected activity grade level badge"
                shape="regular"
                text={gradeLevels[age_group_index]}
                tone="assist"
                wrapInset="0"
              />)}     {selectedActivity.title}
            </Text>
          )}
        </>

        <Button variant={verifyActivityIdButton.variant} loading={verifyActivityIdButton.loading} disabled={verifyActivityIdButton.disabled || activityIdInput.length == 0} onClick={handleVerifyActivityID} stretch>
          {verifyActivityIdButton.text}
        </Button>

        <>
          {verifyAlert.visible && (
            <Alert
              tone={verifyAlert.tone}
              onDismiss={() => setVerifyAlert((prevState) => ({ ...prevState, visible: false }))}
            >
              {verifyAlert.message}
            </Alert>
          )}
        </>



        {/* Generate Slides Box */}
        <Box background="neutralLow" borderRadius="large" padding="2u">
          <Rows spacing="1.5u">

            <Text size="large" variant="bold">Generate Slides</Text>
            <Text>Select a grade level to generate an age-appropriate slide deck for the activity!</Text>
            <Text>Slides are based on the instructions in the activity you selected above.</Text>
            <SegmentedControl
              options={gradeLevelSelectorOptions}
              value={selectedAgeGroupIndex}
              onChange={setSelectedAgeGroupIndex}
            />

            <Text size="large">Slide Content</Text>
            <CheckboxGroup defaultValue={["full"]}
              options={[
                {
                  label: 'Full Activity: PLAY, REFLECT, CONNECT, GROW slides',
                  value: 'full',
                  disabled: true

                },
                {
                  label: 'Greeting: PLAY slide only',
                  value: 'greeting',
                  disabled: true
                }
              ]}
            />
            <Text size="small">Content selection not implemented yet.</Text>

            <Text size="large">Slide Design</Text>
            <CheckboxGroup defaultValue={["PK-5"]}
              options={[
                {
                  label: 'PK-5 Brand Template',
                  value: 'PK-5',
                  disabled: true

                },
                {
                  label: 'MS Brand Template',
                  value: 'MS',
                  disabled: true
                }
              ]}
            />
            <Text size="small">Design selection not implemented yet.</Text>

            <Button variant="primary" disabled={generateSlidesButton.disabled} loading={generateSlidesButton.loading} onClick={handleGenerateSlidesButton} stretch>
              {generateSlidesButton.message}
            </Button>

            {slidesButtonInfoAlert.visible && (
              <Alert tone="warn">
                {slidesButtonInfoAlert.message}
              </Alert>
            )}

            <>
              {generatingAlert.visible && (
                <Alert
                  tone={generatingAlert.tone}
                  onDismiss={() => setGeneratingAlert((prevState) => ({ ...prevState, visible: false }))}
                >
                  {generatingAlert.message}
                </Alert>
              )}
            </>

            <>
              {slideGenerationInProgress && (
                <ProgressBar
                  size="medium"
                  value={slideGenerationProgressValue}
                />
              )}
            </>

          </Rows>
        </Box>
        <Alert tone="info">The slide deck is generated using ChatGPT. Review all slides carefully.</Alert>



        {/* Slide Link Entry Area */}
        <Text size="large" variant="bold">Update Kikori Activity Database</Text>
        <Text>Copy links from the "Share" menu (top-right of the Canva editor) into these text boxes. These links allow Kikori users to access the slides.</Text>
        <Text variant="bold">The labels of each text box match the name of the link in the "Share" menu.</Text>

        <FormField
          control={(props) => <TextInput
            name="publicLink"
            value={publicViewLink}
            onChange={(e) => setPublicViewLink(e)}
            {...props}
          />}
          label="Public view link"
        />

        {publicLinkAlert.visible && (
          <Alert tone={publicLinkAlert.tone} onClose={() => setPublicLinkAlert({ ...publicLinkAlert, visible: false })}>
            {publicLinkAlert.message}
          </Alert>
        )}

        <FormField
          control={(props) => <TextInput
            name="templateLink"
            value={templateLink}
            onChange={(e) => setTemplateLink(e)}
            {...props}
          />}
          label="Template link"
        />

        {templateLinkAlert.visible && (
          <Alert tone={templateLinkAlert.tone} onClose={() => setTemplateLinkAlert({ ...templateLinkAlert, visible: false })}>
            {templateLinkAlert.message}
          </Alert>
        )}

        <FormField
          control={(props) => <TextInput
            name="collaborationLink"
            value={collaborationLink}
            onChange={(e) => setCollaborationLink(e)}
            {...props}
          />}
          label="Collaboration link"
        />

        {collaborationLinkAlert.visible && (
          <Alert tone={collaborationLinkAlert.tone} onClose={() => setCollaborationLinkAlert({ ...collaborationLinkAlert, visible: false })}>
            {collaborationLinkAlert.message}
          </Alert>
        )}

        <Alert tone="info">
          Various checks are performed before updating the Kikori database.
          This app won't let you accidentally corrupt the database.
        </Alert>



        {/* Update Slides Box */}
        <Box background="neutralLow" borderRadius="large" padding="2u">
          <Rows spacing="1.5u">

            <Text size="large" variant="bold">Update Slides of Existing Activity</Text>
            <Text>Click this button to update the slide links in the selected activity.</Text>
            <Text>This will NOT create a new activity; this updates the slides of an existing activity.</Text>

            <>
              {updateSlidesInfoAlert.visible && (
                <Alert tone={updateSlidesInfoAlert.tone}>
                  {updateSlidesInfoAlert.message}
                </Alert>
              )}
            </>

            <>
              {updateSlidesResultAlert.visible && (
                <Alert tone={updateSlidesResultAlert.tone} onDismiss={() => setUpdateSlidesResultAlert((p) => ({ ...p, visible: false }))}>
                  {updateSlidesResultAlert.message}
                </Alert>
              )}
            </>

            <Button
              variant="primary"
              disabled={updateSlidesButton.disabled}
              onClick={() => { disableAllResultAlerts(); setWaitingForPdfExport(true) }}
              loading={updateSlidesButton.loading}
              stretch
            >
              {updateSlidesButton.message}
            </Button>

            {waitingForPdfExport && (<Alert tone="critical">
              Canva will now generate a static PDF of the slide deck for Kikori. Make sure to select "Flatten PDF" on the next menu to avoid formatting and file size issues.

              Click "Export PDF" to proceed.
            </Alert>)}

            {waitingForPdfExport && (
              <Button variant="secondary" onClick={handleExportPDFButton}>
                Export PDF
              </Button>
            )}

            {waitingForPdfExport && (
              <Button variant="tertiary" onClick={() => setWaitingForPdfExport(false)}>
                Cancel Update Slides
              </Button>)}

          </Rows>
        </Box>
        <Alert tone="info">This updates ONLY the slides field of the selected activity.</Alert>



        {/* Create Variation Box NOT USING FOR NOW
        {(
        <Box
          background="neutralLow"
          borderRadius="large"
          padding="2u"
        >
          <Rows spacing="1.5u">
            <Text size="large" variant="bold">Create New Variation with Slides</Text>
            <Text>Select age group(s) and click this button to create an age group variation of the activity.</Text>
            <Text>This WILL create a new activity, for the selected ages, including this slide deck. To update an existing activity, scroll up.</Text>


            <SegmentedControl
              options={gradeLevelSelectorOptions}
              value={selectedAgeGroupIndex}
              onChange={setSelectedAgeGroupIndex}
            />

            <Switch defaultValue={false} disabled={true} label="Variation is for any K-5 classroom" description="This sets age group to PK-K, 1-2, and 3-5. Not implemented yet."></Switch>

            <>
              {createVariationInfoAlert.visible &&
                (<Alert tone={createVariationInfoAlert.tone}>
                  {createVariationInfoAlert.message}
                </Alert>)
              }
            </>

            <> {createVariationResultAlert.visible &&
              (<Alert tone={createVariationResultAlert.tone} onDismiss={() => { setCreateVariationResultAlert((p) => ({ ...p, visible: false })) }}>
                {createVariationResultAlert.message}
              </Alert>)
            }
            </>

            <Button variant="secondary" onClick={handleCreateVariationButton} disabled={createVariationButton.disabled} stretch>
              {createVariationButton.message}
            </Button>

          </Rows>
        </Box>
        <Alert tone="info">Instructions, title, and tags in the new variation will be copied from the original activity.</Alert>
        
        */}

      </Rows>
    </div>
  );
};
