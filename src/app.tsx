import { useState } from "react";
import { Button, Rows, Text, Select, FormField, TextInput, Alert } from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "styles/components.css";
import { selection, SelectionEvent, addPage, getCurrentPageContext, openDesign, addNativeElement } from "@canva/design";
import { requestFontSelection, findFonts, getTemporaryUrl } from "@canva/asset";
import { useAddElement } from "utils/use_add_element";
import { useSelection } from "utils/use_selection_hook";
import { upload } from "@canva/asset";

import mongodb_response from "./api_calls/basic_call.json";
import chatgpt_response from "./api_calls/chatgpt_demo.json";

const API_URL = "https://kikori-slides-api-08c1d2c0a600.herokuapp.com";

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
  const FONTS = {
    "Wedges": "YAEKEi3zNJo:0"
  };

  const slideDeck = chatgpt_response["slides"][0];

  const plaintextSelection = useSelection("plaintext");
  const plaintextElementSelected = plaintextSelection.count > 0;
  const [slideSelected, setSlideSelected] = useState("");
  const DEFAULT_ID = "6NyRnQ4h0mqQne3KE1Nm"
  const [activityIdInput, setActivityIdInput] = useState(DEFAULT_ID);
  const [slidesButtonDisabled, setSlidesButtonDisabled] = useState(true);
  const [fetchAlertVisible, setFetchAlertVisible] = useState(false);
  const [fetchAlertMessage, setFetchAlertMessage] = useState("");
  const [fetchAlertTone, setFetchAlertTone] = useState("warn");

  async function handleActivityIdInput(id) {
    setActivityIdInput(id);
    setSlidesButtonDisabled(true);
    setFetchAlertVisible(false);
  }

  
  
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



  const addElement = useAddElement();

  const onClick = () => {
    addElement({
      type: "text",
      children: ["Hello world!"],
    });
  };

  async function replacePlaintext() {
    if (!plaintextElementSelected) {
      return;
    }

    const draft = await plaintextSelection.read();
    console.log(draft.contents);

    for (const content of draft.contents) {
      //const text = await extractText(mongodb_response["data"]["playing"]);
      //console.log(text);
      content.text = slideDeck[slideSelected][0];
    }
    await draft.save();
  }

  const handleSlideSelect = (selectionEvent) => {
    setSlideSelected(selectionEvent);
    console.log("selected slide: " + selectionEvent);
  }

  const createRoundedRectPath = (width: number, height: number, radius: number) =>
    `M ${radius} 0 H ${width - radius} A ${radius} ${radius} 0 0 1 ${width} ${radius} V ${height - radius} A ${radius} ${radius} 0 0 1 ${width - radius} ${height} H ${radius} A ${radius} ${radius} 0 0 1 0 ${height - radius} V ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0 Z`;

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

    const logo_ref = "MAGSXRuIsBQ:1";

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

  const [generatingAlertVisible, setGeneratingAlertVisible] = useState(false);
  const [generatingAlertMessage, setGeneratingAlertMessage] = useState("Generating...");
  const [generatingAlertTone, setGeneratingAlertTone] = useState("neutral");

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

  async function fontPickerButton() {
    const fontResponse = await requestFontSelection();
    console.log(fontResponse);
  }

  async function handleOpenDesign(draft, helpers) {
    console.log(draft);
    console.log(helpers);
  }

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

  const intl = useIntl();

  const currentSelection = useSelection("image");
  const isElementSelected = currentSelection.count > 0;

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
        {/*
        <Button variant="secondary" onClick={handleGenerateSlides} stretch>
          Generate instructions
        </Button>
        <Button variant="secondary" onClick={printElementsButton} stretch>
          print elements to console
        </Button>
        <Button variant="secondary" onClick={handleClick} stretch>
          print selected image ref
        </Button>
        <Button variant="tertiary" onClick={onClick} stretch>
          {intl.formatMessage({
            defaultMessage: "Do something cool",
            description:
              "Button text to do something cool. Creates a new text element when pressed.",
          })}
        </Button>
        */}
      </Rows>
    </div>
  );
};
