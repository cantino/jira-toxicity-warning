import ForgeUI, {render, Fragment, Text, IssuePanel, useState, useProductContext, Button} from '@forge/ui';
import api from "@forge/api";

function toSentence(items) {
  if (items.length === 0) {
    return "";
  } else if (items.length === 1) {
    return items[0];
  } else if (items.length === 2) {
    return `${items[0]} or ${items[1]}`;
  } else {
    const last = items.pop();
    return `${items.join(", ")}, or ${last}`;
  }
}

const descriptionMap = {
  identity_attack: "attacking someone's identity",
  insult: "insulting",
  obscene: "obscene",
  severe_toxicity: "severly toxic",
  sexual_explicit: "sexually explicit",
  threat: "threatening",
  toxicity: "toxic"
};

let modelCache = null;

async function fetchText(issueKey) {
  const issueResponse = await api.asApp().requestJira(`/rest/api/2/issue/${issueKey}?fields=summary,description`);

  if (!issueResponse.ok) {
    const message = `Error: ${issueResponse.status} ${await issueResponse.text()}`;
    console.error(message);
    throw new Error(message);
  }

  const {summary, description} = (await issueResponse.json()).fields;

  const text = `${summary}. ${description}`;

  // Due to the version of node being used by Forge, I couldn't run tfjs in Forge:
  //     TypeError: this.util.TextEncoder is not a constructor at new PlatformNode (index.js:17446:28)
  // So I set it up in Glitch instead: https://glitch.com/edit/#!/toxic-text-classifier
  const classificationResponse = await api.fetch(`https://toxic-text-classifier.glitch.me/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ text })
  });

  if (!classificationResponse.ok) {
    const message = `Error: ${classificationResponse.status} ${await classificationResponse.text()}`;
    console.error(message);
    throw new Error(message);
  }

  const predictions = await classificationResponse.json();
  const cleanedPredictions = predictions.map(prediction => {
    return { label: prediction.label, results: prediction.results.filter(r => r.match) };
  });
  const matchingPredictions = cleanedPredictions.filter(prediction => prediction.label !== "obscene" && prediction.results.length);
  if (matchingPredictions.length) {
    return `This Issue's title or description may come across as ${toSentence(matchingPredictions.map(prediction => descriptionMap[prediction.label]))}.`;
  } else {
    return "This Issue's title and description both look fine.";
  }
}

const App = () => {
  const [result, setResult] = useState("");

  const { platformContext: { issueKey } } = useProductContext();

  return (
    <Fragment>
      <Text content={result} />
      <Button
        text={result ? "Re-analyze" : "Analyze"}
        onClick={async () => { return setResult(await fetchText(issueKey)); }}
      />
    </Fragment>
  );
};

export const run = render(
  <IssuePanel>
    <App />
  </IssuePanel>
);
