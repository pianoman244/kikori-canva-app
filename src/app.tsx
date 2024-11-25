import { useState, useEffect } from "react";
import {
  Button, Rows, Title, Text, FormField, TextInput, CheckboxGroup, SegmentedControl, Alert, Badge, ProgressBar, LoadingIndicator
} from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "styles/components.css";
import { addPage, getCurrentPageContext, requestExport } from "@canva/design";
import { requestFontSelection, findFonts, getTemporaryUrl } from "@canva/asset";
import { auth } from "@canva/user";

import { useSelection } from "utils/use_selection_hook";
import axios from 'axios';

import mongodb_response from "./api_calls/basic_call.json"; // demo fetchActivity response if api is down
import chatgpt_response from "./api_calls/chatgpt_demo.json"; // demo chatgpt response to avoid using tokens

const API_URL = "https://kikori-slides-api-08c1d2c0a600.herokuapp.com"; // Heroku API for database querying and ChatGPT calls

// const DEFAULT_ID = "6NyRnQ4h0mqQne3KE1Nm" // from LIVE database
const DEFAULT_ID = "66a16fe0a17a5ac6a7936c5d" // from sandbox database, parent variation
// const DEFAULT_ID = "66deb0c59cb7a67d18c1ef29" // from sandbox database, test activity with one age group


/*
example links
collab: https://www.canva.com/design/DAGXIVPRmVA/BNuGvlizjon2eBApbrgTuA/edit?utm_content=DAGXIVPRmVA&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton
public: https://www.canva.com/design/DAGXIVPRmVA/E71n1hbRx0isF7PtHfK_FQ/view?utm_content=DAGXIVPRmVA&utm_campaign=designshare&utm_medium=link&utm_source=editor
template: https://www.canva.com/design/DAGXIVPRmVA/hFSV5q0X2VRXsyh290v1xw/view?utm_content=DAGXIVPRmVA&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview
*/

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
  const slideDeck = chatgpt_response["slides"][0]; // demo slide deck for testing purposes

  /* state variables for various app elements */

  // user selections for editing (not used at the moment)
  const plaintextSelection = useSelection("plaintext"); // for tracking a user selection of plaintext for editing
  const plaintextElementSelected = plaintextSelection.count > 0;
  const currentSelection = useSelection("image"); // for tracking user selection of image
  const isElementSelected = currentSelection.count > 0;
  const [slideSelected, setSlideSelected] = useState(""); // for tracking which slide is selected for editing

  // inputs
  const [activityIdInput, setActivityIdInput] = useState(""); // for tracking activity ID input
  const [activityIdInputDisabled, setActivityIdInputDisabled] = useState(false); // for enabling/disabling input field
  const [selectedAgeGroupIndex, setSelectedAgeGroupIndex] = useState(-1); // grade level segmented selector
  const [collaborationLink, setCollaborationLink] = useState(""); // collaboration link text field
  const [templateLink, setTemplateLink] = useState(""); // brand template link text field
  const [publicViewLink, setPublicViewLink] = useState(""); // public link text field

  // UPDATE THIS; false by default (make it clear that this activity was created with canva bot)
  const [inheritCreatorIdInput, setInheritCreatorIdInput] = useState(false);

  // UPDATE THIS; default to age group variation
  const [variationDescription, setVariationDescription] = useState("Age group variation"); // variation description text field

  // buttons
  const [verifyActivityIdButton, setVerifyActivityIdButton] = useState({ variant: "primary", text: "Fetch Activity by ID", disabled: false })
  const [generateSlidesButton, setGenerateSlidesButton] = useState({ disabled: true, message: "Generate slides" }); // for enabling/disabling generate slides button
  const [createVariationButton, setCreateVariationButton] = useState({ disabled: false, message: "Create variation" }); // create variation button state
  const [updateSlidesButton, setUpdateSlidesButton] = useState({ disabled: true, message: "Update slide links" }); // update slide links button state

  // other computed states
  type Activity = { _id: string; age_group: number[]; title: string; };
  const [selectedActivity, setSelectedActivity] = useState<Activity>({ _id: "", age_group: [], title: "" }); // set when activity is verified
  const [slideGenerationInProgress, setSlideGenerationInProgress] = useState(false); // used to render progress bar
  const [slideGenerationProgressValue, setSlideGenerationProgressValue] = useState(0); // progress of progress bar

  // CHANGE THIS; set to chassenathan user ID for now
  const [currentUser, setCurrentUser] = useState({ id: "GEvIbLpTT4hgw135BioFr9njDGB2" });

  const [isCreatingVariation, setIsCreatingVariation] = useState(false); // to disable createVariation button/alert updates

  // alerts
  const [verifyAlert, setVerifyAlert] = useState({ visible: false, message: "", tone: "warn" }); // verifying ID alert
  const [generatingAlert, setGeneratingAlert] = useState({ visible: false, message: "Generating...", tone: "neutral" }); // generating slides alert
  // persistent informational alert below the slides button explaining how to use it
  const [slidesButtonInfoAlert, setSlidesButtonInfoAlert] = useState({ message: "Select an activity to generate slides." });
  const [collaborationLinkAlert, setCollaborationLinkAlert] = useState({ visible: false, message: "", tone: "warn" }); // collaboration link validatoin
  const [templateLinkAlert, setTemplateLinkAlert] = useState({ visible: false, message: "", tone: "warn" }); // brand template link validation
  const [publicLinkAlert, setPublicLinkAlert] = useState({ visible: false, message: "", tone: "warn" }); // public link validation
  const [createVariationInfoAlert, setCreateVariationInfoAlert] = useState({ visible: true, message: "Select an activity to create a variation.", tone: "warn" }); // info for create variation button
  const [createVariationResultAlert, setCreateVariationResultAlert] = useState({ visible: false, message: "", tone: "" }); // error alert for if create variation fails
  const [updateSlidesInfoAlert, setUpdateSlidesInfoAlert] = useState({ visible: true, message: "Select an activity to update its slide links." }); // info for update slides button

  /* handlers for app element interaction */

  // handler for "Verify activity ID" button
  async function handleVerifyActivityID() {

    // if no activity is selected currently, this button searches for a new one based on activity ID text input
    if (selectedActivity._id == "") {
      setVerifyActivityIdButton((prevState) => ({ ...prevState, disabled: true })); // disable button while searching

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
          setVerifyAlert({ visible: true, message: `Activity found!`, tone: "positive" }); // alert
          setSelectedActivity({ _id: data._id, age_group: data.age_group, title: data.title }); // save some activity for other things to reference
          setActivityIdInputDisabled(true);
          setVerifyActivityIdButton({ variant: "secondary", disabled: false, text: "Use other activity" }); // re-enable button and change function
        }
      }

      // if an activity is currently selected, this button resets the selected activity which affects other things via useEffects
    } else {
      setSelectedActivity({ _id: "", age_group: [], title: "" }); // reset activity selection
      setVerifyActivityIdButton({ variant: "primary", disabled: false, text: "Verify Activity ID" }); // reset this button
      setActivityIdInputDisabled(false); // re-enable activity id input
      setVerifyAlert((prevState) => ({ ...prevState, visible: false })); // hide alerts
    }
  }

  // handler for "Generate Slides" button
  async function handleGenerateSlidesButton() {
    try {
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


  async function handleCreateVariationButton() {
    setIsCreatingVariation(true); // disable normal button and alert updates
    setCreateVariationInfoAlert({ visible: false, message: "", tone: "neutral" });
    setCreateVariationButton({ disabled: true, message: "Creating variation..." });

    try {

      // export PDF with Canva Connect API
      const export_blob = await requestExport({ "acceptedFileTypes": ["pdf_standard"] });
      if (export_blob.status === "aborted") {
        throw new Error("Canva PDF export was aborted");
      }

      console.log("export_blob:", export_blob);
      const canvaExportBlobUrl = export_blob.exportBlobs[0].url;

      // Upload to Firebase using backend
      const uploadPdfResponse = await fetch(API_URL + '/uploadPdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exportBlobUrl: canvaExportBlobUrl,
          activityId: selectedActivity._id,
          activityName: selectedActivity.title,
        })
      });


      if (!uploadPdfResponse.ok) {
        const errorData = await uploadPdfResponse.json();
        setCreateVariationResultAlert({
          visible: true,
          tone: "warn",
          message: `Error uploading PDF: ${errorData?.message ?? "Unknown error"}`
        });
        console.error("Error uploading PDF:", errorData);
        return;
      }

      const pdfData = await uploadPdfResponse.json();
      console.log("PDF uploaded successfully:", pdfData);

      // Step 2: Use the uploaded PDF details to create the variation
      const requestBody = {
        activityId: selectedActivity._id,
        ageGroup: [selectedAgeGroupIndex],
        userID: currentUser.id, 
        inheritCreatorID: inheritCreatorIdInput, 
        variation: variationDescription, 
        slides: {
          publicViewLink: publicViewLink,
          collaborationLink: collaborationLink,
          templateLink: templateLink,
          pdf: {
            name: pdfData.pdfName, 
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
      setIsCreatingVariation(false); // re-enable button and alert updates
    }
  }


  /*
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
  */

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

  // Effect to enable "Create Activity Variation" button and modify alert based on all conditions
  useEffect(() => {
    if (isCreatingVariation) return; // do nothing if variation is being created currently

    const multipleGradesInSelectedActivity = selectedActivity.age_group.length > 1;
    const linksValid = identifyCanvaLinkType(collaborationLink) === 'collaboration' &&
      identifyCanvaLinkType(templateLink) === 'template' &&
      identifyCanvaLinkType(publicViewLink) === 'public view';

    if (selectedActivity._id == "") {
      setCreateVariationInfoAlert({ visible: true, message: "Select an activity to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: "Create variation" });
    } else if (!multipleGradesInSelectedActivity) {
      setCreateVariationInfoAlert({ visible: true, message: "The selected activity only has one age group. Find the parent activity to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: "Create variation" });
    } else if (selectedAgeGroupIndex == -1) {
      setCreateVariationInfoAlert({ visible: true, message: "Select a grade level to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: "Create variation for selected activity" });
    } else if (!linksValid) {
      setCreateVariationInfoAlert({ visible: true, message: "Enter valid collaboration and brand template links to create a variation.", tone: "warn" });
      setCreateVariationButton({ disabled: true, message: `Create variation for ${gradeLevels[selectedAgeGroupIndex]}` });
    } else {
      setCreateVariationInfoAlert({ visible: false, message: "", tone: "warn" });
      setCreateVariationButton({ disabled: false, message: `Create variation for ${gradeLevels[selectedAgeGroupIndex]}` });
    }

  }, [selectedAgeGroupIndex, selectedActivity, collaborationLink, templateLink, isCreatingVariation]);

  // Effect to enable "Update Slides" button and modify alert
  useEffect(() => {
    if (selectedActivity._id == "") {
      setUpdateSlidesButton({ disabled: true, message: "Update slide links" });
      setUpdateSlidesInfoAlert({ visible: true, message: "Select an activity to update its slide links." });
    } else {
      setUpdateSlidesButton({ disabled: false, message: "Update slide links for selected activity" });
      setUpdateSlidesInfoAlert({ visible: false, message: "" });
    }
  }, [selectedActivity])

  // Set generating slides button and persistent informational alert below it
  useEffect(() => {
    if (!slideGenerationInProgress) {
      if (selectedActivity._id == "") {
        setGenerateSlidesButton({ disabled: true, message: "Generate slides" });
        setSlidesButtonInfoAlert({ message: "Select an activity to generate slides." });
      } else if (selectedActivity._id != "" && selectedAgeGroupIndex == -1) {
        setGenerateSlidesButton({ disabled: true, message: "Generate slides for selected activity" });
        setSlidesButtonInfoAlert({ message: "Select a grade level to generate slides for the selected activity." });
      } else if (selectedActivity._id != "" && selectedAgeGroupIndex != -1) {
        setGenerateSlidesButton({ disabled: false, message: `Generate slides for ${gradeLevels[selectedAgeGroupIndex]}` });
        setSlidesButtonInfoAlert({ message: "If you interact with Canva while slides are generating, they may generate out of order." });
      }
    } else {
      setGenerateSlidesButton({ disabled: true, message: "Generating slides..." });
      setSlidesButtonInfoAlert({ message: "If you interact with Canva while slides are generating, they may generate out of order." });
    }
  }, [selectedActivity, selectedAgeGroupIndex, slideGenerationInProgress])

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
        <Text size="large">
          In this app, you can:
        </Text>
        <CheckboxGroup defaultValue={["generate", "create"]}
          options={[
            {
              label: 'Generate slides for the activity for a new grade level based on the lesson plan embedded in the activity',
              value: 'generate'
            },
            {
              label: 'Update the slide information for the selected activity (live Canva links and static PDF copy) in the Kikori app',
              value: 'update',
              description: "Not implemented yet!",
              disabled: true
            },
            {
              label: 'Create a variation of the activity in the Kikori app for the selected grade level using this slide deck',
              value: 'create',
            }
          ]}
        />
        <Text variant="bold" tone="tertiary">Copy an activity ID from the Kikori app or admin panel and enter it into the text box to get started!</Text>

        <FormField
          control={(props) => <TextInput
            name="Activity ID Input"
            disabled={activityIdInputDisabled}
            placeholder="Copy activity ID from Kikori app"
            defaultValue={DEFAULT_ID}
            onChange={setActivityIdInput} {...props}
          />}
          label="Select Activity (by ID)"
          description="This will fetch the selected activity from the Kikori database so Canva can interact with it."
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

        <Button variant={verifyActivityIdButton.variant} disabled={verifyActivityIdButton.disabled || activityIdInput.length == 0} onClick={handleVerifyActivityID} stretch>
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

        <Text alignment="center">
          * * * * * * *
        </Text>

        <Text size="large" variant="bold">Generate Slides</Text>

        <Text>Select a grade level to generate an age-appropriate slide deck for the activity based on the lesson plan!</Text>
        <Text>Currently, this will always generate slides for Play, Reflect, Connect, AND Grow. More options will be added eventually.</Text>
        <Text size="small">The slide deck is generated using ChatGPT. Review all slides carefully.</Text>

        <SegmentedControl
          options={gradeLevelSelectorOptions}
          value={selectedAgeGroupIndex}
          onChange={setSelectedAgeGroupIndex}
        />

        <Button variant="primary" disabled={generateSlidesButton.disabled} onClick={handleGenerateSlidesButton} stretch>
          {generateSlidesButton.message}
        </Button>

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

        <Alert tone="warn">
          {slidesButtonInfoAlert.message}
        </Alert>

        <Text size="large" variant="bold">Upate Kikori Activity Database</Text>

        <Text>Enter the collaboration and brand template links to update the slide links in the activity or create a new variation of it.</Text>
        <Text size="small">
          Various checks will be performed before creating a variation or updating an activity.
          This app won't let you accidentally corrupt the database.
        </Text>

        <Text size="small">
          Copy these links from the share menu. They cannot be generated automatically, unfortunately. (The PDF can.)
        </Text>

        <FormField
          control={(props) => <TextInput
            name="publicLink"
            value={publicViewLink}
            onChange={(e) => setPublicViewLink(e)}
            {...props}
          />}
          label="Public view link"
        />

        {/* Public Link Alert */}
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

        {/* Template Link Alert */}
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

        {/* Collaboration Link Alert */}
        {collaborationLinkAlert.visible && (
          <Alert tone={collaborationLinkAlert.tone} onClose={() => setCollaborationLinkAlert({ ...collaborationLinkAlert, visible: false })}>
            {collaborationLinkAlert.message}
          </Alert>
        )}

        <Text
          alignment="start"
          capitalization="default"
          size="medium"
          variant="regular"
        >
          Click this button to update the selected activity! The new collaboration and brand template links will be entered into the activity in the database.
        </Text>

        <Button variant="secondary" disabled={/*updateSlidesButton.disabled*/ true} onClick={handleNothingClick} stretch>
          {/*updateSlidesButton.message*/ "Update slides (not implemented)"}
        </Button>

        <>
          {updateSlidesInfoAlert.visible && (
            <Alert tone="warn">
              {updateSlidesInfoAlert.message}
            </Alert>
          )}
        </>

        <Text
          alignment="start"
          capitalization="default"
          size="medium"
          variant="regular"
        >
          Select a grade level to create a new variation of the selected activity using this slide deck!
          The variation will be created using the same process as the Kikori app.
        </Text>

        <SegmentedControl
          options={gradeLevelSelectorOptions}
          value={selectedAgeGroupIndex}
          onChange={setSelectedAgeGroupIndex}
        />

        <>
          {createVariationInfoAlert.visible &&
            (<Alert tone="warn">
              {createVariationInfoAlert.message}
            </Alert>)
          }
        </>

        <> {isCreatingVariation && (
          <LoadingIndicator size="medium" />
        )} </>

    <FormField
          control={(props) => <TextInput
            name="variationDescription"
            defaultValue="Age group variation"
            value={variationDescription}
            onChange={(e) => setVariationDescription(e)}
            {...props}
          />}
          label="Variation description"
        />

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
    </div>
  );
};
