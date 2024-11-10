import { useState } from "react";
import { Button, Rows, Text, Select, FormField, TextInput, Alert } from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "styles/components.css";
import { addPage, getCurrentPageContext, openDesign, addNativeElement } from "@canva/design";
import { requestFontSelection, findFonts, getTemporaryUrl } from "@canva/asset";
import { useSelection } from "utils/use_selection_hook";

import mongodb_response from "./api_calls/basic_call.json"; // demo fetchActivity response if api is down
import chatgpt_response from "./api_calls/chatgpt_demo.json"; // demo chatgpt response to avoid using tokens

const API_URL = "https://kikori-slides-api-08c1d2c0a600.herokuapp.com";

// helper function to call API to generate slides for given activity and grade level
// activityId is just the activity id string, gradeLevel is something from the list ["PK-K", "1-2", "3-5", "MS", "HS"]
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

export const App = () => {
  // Kikori's selected font for the slide titles
  const FONTS = {
    "Wedges": "YAEKEi3zNJo:0"
  };

  const slideDeck = chatgpt_response["slides"][0]; // demo slide deck for testing purposes

  /* state variables for various app elements */

  const plaintextSelection = useSelection("plaintext"); // for tracking a user selection of plaintext for editing
  const plaintextElementSelected = plaintextSelection.count > 0;
  const currentSelection = useSelection("image"); // for tracking user selection of image
  const isElementSelected = currentSelection.count > 0;
  const [slideSelected, setSlideSelected] = useState(""); // for tracking which slide is selected for editing
  const DEFAULT_ID = "6NyRnQ4h0mqQne3KE1Nm" // some activity ID from the LIVE database as a default
  const [activityIdInput, setActivityIdInput] = useState(DEFAULT_ID); // for tracking activity ID input
  const [slidesButtonDisabled, setSlidesButtonDisabled] = useState(true); // for enabling/disabling generate slides button

  // for the "fetched slides" alert (pops up with Verify ID button is clicked)
  const [fetchAlertVisible, setFetchAlertVisible] = useState(false);
  const [fetchAlertMessage, setFetchAlertMessage] = useState("");
  const [fetchAlertTone, setFetchAlertTone] = useState("warn");

  // for the "generating slides" alert (updates as ChatGPT generates slides and then new slides are added to the slide deck)
  const [generatingAlertVisible, setGeneratingAlertVisible] = useState(false);
  const [generatingAlertMessage, setGeneratingAlertMessage] = useState("Generating...");
  const [generatingAlertTone, setGeneratingAlertTone] = useState("neutral");


  /* handlers for app element interaction */ 

  // runs whenever activity id text box is updated
  async function handleActivityIdInput(id) {
    setActivityIdInput(id);
    setSlidesButtonDisabled(true);
    setFetchAlertVisible(false);
  }
  
  // handler for "Verify activity ID" button
  async function handleFetchActivity() {
    const activityId = activityIdInput;
    const response = await fetch(API_URL + '/fetchActivity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ activityId })
    });

    if (!response.ok) {
      setFetchAlertMessage(`No activity with that ID`);
      setFetchAlertTone("warn");
      setFetchAlertVisible(true);
    } else {
      const activity = await response.json();
      console.log("fetched activity with id " + activityIdInput + ": " + JSON.stringify(activity));

      setFetchAlertMessage(`Successfully fetched activity: ${activity.activityData.title}`);
      setFetchAlertTone("positive");
      setFetchAlertVisible(true);
      setSlidesButtonDisabled(false);
    }

  }

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

  // handler for "Generate Slides" button
  async function generateSlidesButton() {
    setGeneratingAlertVisible(true);
    setGeneratingAlertMessage("Generating...");
    setGeneratingAlertTone("neutral");

    const sel_cycle = ["play", "reflect", "connect", "grow"];
    const response = await generateSlides(activityIdInput, "1-2");
    const deck = response.chatgptResponse.slides[0];
    console.log("Response: " + JSON.stringify(response));
    console.log("Deck: " + JSON.stringify(deck));
    for (const section of sel_cycle) {
      console.log(section);
      const slides = deck[section];
      console.log(slides);
      for (const slideContent of slides) {
        await addPageHelper(section, slideContent);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    setGeneratingAlertMessage("Slides generated!");
    setGeneratingAlertTone("positive");
  }

  // helper function for when I needed to figure out the reference for the fonts we use
  async function fontPickerButton() {
    const fontResponse = await requestFontSelection();
    console.log(fontResponse);
  }

  // helper function for exploring beta method openDesign in Canva SDK
  async function handleOpenDesign(draft, helpers) {
    console.log(draft);
    console.log(helpers);
  }

  // helper function to print all elements on the page to explore the elementBuilder thing in Canva SDK
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
      /*
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
      */
    });
  }

  // event handler that can print the element that was just clicked and some details about it
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

  // default generateSlides handler; used for testing the generateSlides logic reliably
  async function handleGenerateSlides() {
    const activityId = "6NyRnQ4h0mqQne3KE1Nm";
    const gradeLevel = "1-2";
    const slides = await generateSlides(activityId, gradeLevel);
    console.log(slides);
  }

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <Text>
          <FormattedMessage
            defaultMessage="
              Kikori slides generator! 
            "
            description="hiiiii"
            values={{
              code: (chunks) => <code>{chunks}</code>,
            }}
          />
        </Text>
        <FormField
          control={(props) => <TextInput name="Activity ID Input" onChange={handleActivityIdInput} defaultValue={DEFAULT_ID} {...props} />}
          description="Input the ID of an activity in the Kikori app"
          label="Activity ID"
        />
        <Button variant="secondary" onClick={handleFetchActivity} stretch>
          Verify activity ID
        </Button>
        <>
          {fetchAlertVisible && (
            <Alert
              tone={fetchAlertTone}
              onDismiss={() => setFetchAlertVisible(false)}
            >
              {fetchAlertMessage}
            </Alert>
          )}
        </>
        <Button variant="primary" disabled={slidesButtonDisabled} onClick={generateSlidesButton} stretch>
          Create slides from instructions
        </Button>
        <>
          {generatingAlertVisible && (
            <Alert
              tone={generatingAlertTone}
              onDismiss={() => setGeneratingAlertVisible(false)}
            >
              {generatingAlertMessage}
            </Alert>
          )}
        </>
        <Alert tone="info">  
          If you interact with Canva while slides are generating, they may generate out of order.
        </Alert>
        {/* some helpful stuff I used when testing
        <Button variant="secondary" onClick={handleGenerateSlides} stretch>
          Generate instructions
        </Button>
        <Button variant="secondary" onClick={printElementsButton} stretch>
          print elements to console
        </Button>
        <Button variant="secondary" onClick={handleClick} stretch>
          print selected image ref
        </Button>
        */}
      </Rows>
    </div>
  );
};
