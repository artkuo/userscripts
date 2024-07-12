// ==UserScript==
// @name        Wealthsimple export transactions as CSV
// @namespace   Violentmonkey Scripts
// @match       https://my.wealthsimple.com/*
// @grant       GM.xmlHttpRequest
// @version     1.0
// @license     MIT
// @author      eaglesemanation
// @description Adds export buttons to Activity feed and to Account specific activity. They will export transactions within certain timeframe into CSV, options are "This Month", "Last 3 Month", "All". This should provide better transaction description than what is provided by preexisting CSV export feature.
// ==/UserScript==

/**
 * @callback ReadyPredicate
 * @returns {boolean}
 */

/**
 * @typedef {Object} PageInfo
 * @property {"account-details" | "activity" | null} pageType
 * @property {HTMLElement?} anchor - Element to which buttons will be "attached". Buttons should be inserted before it.
 * @property {ReadyPredicate?} readyPredicate - Verifies if ready to insert
 */

/**
 * Figures out which paget we're currently on and where to attach buttons. Should not do any queries,
 * because it gets spammed executed by MutationObserver.
 *
 * @returns {PageInfo}
 */
function getPageInfo() {
  /**
   * @type PageInfo
   */
  let emptyInfo = {
    pageType: null,
    anchor: null,
    readyPredicate: null,
    accountsInfo: null,
  };
  let info = structuredClone(emptyInfo);

  let pathParts = window.location.pathname.split("/");
  if (pathParts.length === 4 && pathParts[2] === "account-details") {
    // All classes within HTML have been obfuscated/minified, using icons as a starting point, in hope that they don't change that much.
    const threeDotsSvgPath =
      "M5.333 11.997c0 1.466-1.2 2.666-2.666 2.666A2.675 2.675 0 0 1 0 11.997C0 10.53 1.2 9.33 2.667 9.33c1.466 0 2.666 1.2 2.666 2.667Zm16-2.667a2.675 2.675 0 0 0-2.666 2.667c0 1.466 1.2 2.666 2.666 2.666 1.467 0 2.667-1.2 2.667-2.666 0-1.467-1.2-2.667-2.667-2.667ZM12 9.33a2.675 2.675 0 0 0-2.667 2.667c0 1.466 1.2 2.666 2.667 2.666 1.467 0 2.667-1.2 2.667-2.666 0-1.467-1.2-2.667-2.667-2.667Z";
    const threeDotsButtonContainerQuery = `div:has(> div > button svg > path[d="${threeDotsSvgPath}"])`;

    info.pageType = "account-details";
    let anchor = document.querySelectorAll(threeDotsButtonContainerQuery);
    if (anchor.length !== 1) {
      return emptyInfo;
    }
    info.anchor = anchor[0];
    info.readyPredicate = () => info.anchor.parentNode.children.length >= 2;
  } else if (pathParts.length === 3 && pathParts[2] === "activity") {
    const threeLinesSvgPath =
      "M14 8c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1s.4-1 1-1h10c.6 0 1 .4 1 1Zm1-6H1c-.6 0-1 .4-1 1s.4 1 1 1h14c.6 0 1-.4 1-1s-.4-1-1-1Zm-4 10H5c-.6 0-1 .4-1 1s.4 1 1 1h6c.6 0 1-.4 1-1s-.4-1-1-1Z";
    const threeLinesButtonContainerQuery = `div:has(> button svg > path[d="${threeLinesSvgPath}"])`;

    info.pageType = "activity";
    let anchor = document.querySelectorAll(threeLinesButtonContainerQuery);
    if (anchor.length !== 1) {
      return emptyInfo;
    }
    info.anchor = anchor[0];
    info.readyPredicate = () => info.anchor.parentNode.children.length >= 2;
  } else {
    // Didn't match any expected page
    return emptyInfo;
  }

  return info;
}

// ID for quickly verifying if buttons were already injected
const exportCsvId = "export-transactions-csv";

/**
 * Keeps button shown after rerenders and href changes
 *
 * @returns {Promise<void>}
 */
async function keepButtonShown() {
  // Early exit, to avoid unnecessary requests if already injected
  if (document.querySelector(`div#${exportCsvId}`)) {
    return;
  }

  const pageInfo = getPageInfo();
  if (!pageInfo.pageType) {
    return;
  }
  if (!(pageInfo.readyPredicate && pageInfo.readyPredicate())) {
    return;
  }

  addButtons(pageInfo);
}

(async function () {
  const observer = new MutationObserver(async (mutations) => {
    for (const _ of mutations) {
      await keepButtonShown();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Try running on load if there are no mutations for some reason
  window.addEventListener("load", async () => {
    await keepButtonShown();
  });
})();

/**
 * Stub, just forcing neovim to corectly highlight CSS syntax in literal
 */
function css(str) {
  return str;
}

const stylesheet = new CSSStyleSheet();
stylesheet.insertRule(css`
  .export-csv-button:hover {
    color: rgb(50, 48, 47);
    background-image: linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.04) 0%,
      rgba(0, 0, 0, 0.04) 100%
    );
  }
`);
stylesheet.insertRule(css`
  .export-csv-button {
    display: inline-flex;
    background: rgb(255, 255, 255);
    border: 1px solid rgb(228, 226, 225);
    border-radius: 4.5em;
    font-size: 16px;
    padding-left: 1em;
    padding-right: 1em;
    font-family: "FuturaPT-Demi";
    font-weight: unset;
  }
`);

/**
 * Attaches button row to anchor element. Should be syncronous to avoid attaching row twice, because Mutex is not cool enough for JS?
 *
 * @param {PageInfo} pageInfo
 * @returns {void}
 */
function addButtons(pageInfo) {
  document.adoptedStyleSheets = [stylesheet];

  let buttonRow = document.createElement("div");
  buttonRow.id = exportCsvId;
  buttonRow.style.display = "flex";
  buttonRow.style.alignItems = "baseline";
  buttonRow.style.gap = "1em";
  buttonRow.style.marginLeft = "auto";

  let buttonRowText = document.createElement("span");
  buttonRowText.innerText = "Export Transactions as CSV:";
  buttonRow.appendChild(buttonRowText);

  const now = new Date();
  const buttons = [
    {
      text: "This Month",
      fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    {
      text: "Last 3 Months",
      fromDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
    },
    {
      text: "All",
      fromDate: null,
    },
  ];

  for (const button of buttons) {
    let exportButton = document.createElement("button");
    exportButton.innerText = button.text;
    exportButton.className = "export-csv-button";
    exportButton.onclick = async () => {
      console.log("Fetching account details");
      let accountsInfo = await accountFinancials();

      let transactions = [];

      console.log("Fetching transactions");
      if (pageInfo.pageType === "account-details") {
        let pathParts = window.location.pathname.split("/");
        accountIds = [pathParts[3]];
        transactions = await activityList(accountIds, button.fromDate);
      } else if (pageInfo.pageType === "activity") {
        let params = new URLSearchParams(window.location.search);
        let ids_param = params.get("account_ids");
        if (ids_param) {
          accountIds = ids_param.split(",");
        } else {
          accountIds = accountsInfo.map((acc) => acc.id);
        }
        transactions = await activityFeedItems(accountIds, button.fromDate);
      }

      let blobs = await transactionsToCsvBlobs(transactions);
      saveBlobsToFiles(blobs, accountsInfo, button.fromDate);
    };

    buttonRow.appendChild(exportButton);
  }

  let anchorParent = pageInfo.anchor.parentNode;
  anchorParent.insertBefore(buttonRow, pageInfo.anchor);
  anchorParent.style.gap = "1em";
  pageInfo.anchor.style.marginLeft = "0";
}

/**
 * @typedef {Object} OauthCookie
 * @property {string} access_token
 * @property {string} identity_canonical_id
 */

/**
 * @returns {OauthCookie}
 */
function getOauthCookie() {
  let decodedCookie = decodeURIComponent(document.cookie).split(";");
  for (let cookieKV of decodedCookie) {
    if (cookieKV.indexOf("_oauth2_access_v2") !== -1) {
      let [_, val] = cookieKV.split("=");
      return JSON.parse(val);
    }
  }
  return null;
}

/**
 * Subset of ActivityFeedItem type in GraphQL API
 *
 * @typedef {Object} Transaction
 * @property {string} accountId
 * @property {string} externalCanonicalId
 * @property {string} amount
 * @property {string} amountSign
 * @property {string} occurredAt
 * @property {string} type
 * @property {string} subType
 * @property {string} eTransferEmail
 * @property {string} eTransferName
 * @property {string} assetSymbol
 * @property {string} assetQuantity
 * @property {string} aftOriginatorName
 * @property {string} aftTransactionCategory
 */

const activityFeedItemFragment = `
  fragment Activity on ActivityFeedItem {
    accountId
    externalCanonicalId
    amount
    amountSign
    occurredAt
    type
    subType
    eTransferEmail
    eTransferName
    assetSymbol
    assetQuantity
    aftOriginatorName
    aftTransactionCategory
  }
`;

const fetchActivityListQuery = `
  query FetchActivityList(
    $first: Int!
    $cursor: Cursor
    $accountIds: [String!]
    $types: [ActivityFeedItemType!]
    $subTypes: [ActivityFeedItemSubType!]
    $endDate: Datetime
    $securityIds: [String]
    $startDate: Datetime
    $legacyStatuses: [String]
  ) {
    activities(
      first: $first
      after: $cursor
      accountIds: $accountIds
      types: $types
      subTypes: $subTypes
      endDate: $endDate
      securityIds: $securityIds
      startDate: $startDate
      legacyStatuses: $legacyStatuses
    ) {
      edges {
        node {
          ...Activity
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * API used by account specific activity view.
 * Seems like it's just outdated API, will use it just as safetyguard
 *
 * @returns {Promise<[Transaction]>}
 */
async function activityList(accountIds, startDate) {
  let transactions = [];
  let hasNextPage = true;
  let cursor = undefined;
  while (hasNextPage) {
    let respJson = await GM.xmlHttpRequest({
      url: "https://my.wealthsimple.com/graphql",
      method: "POST",
      responseType: "json",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getOauthCookie().access_token}`,
      },
      data: JSON.stringify({
        operationName: "FetchActivityList",
        query: `
            ${fetchActivityListQuery}
            ${activityFeedItemFragment}
        `,
        variables: {
          first: 100,
          cursor,
          startDate,
          endDate: new Date().toISOString(),
          accountIds,
        },
      }),
    });

    if (respJson.status !== 200) {
      throw `Failed to fetch transactions: ${respJson.responseText}`;
    }
    let resp = JSON.parse(respJson.responseText);
    let activities = resp.data.activities;
    hasNextPage = activities.pageInfo.hasNextPage;
    cursor = activities.pageInfo.endCursor;
    transactions = transactions.concat(activities.edges.map((e) => e.node));
  }
  return transactions;
}

const fetchActivityFeedItemsQuery = `
  query FetchActivityFeedItems(
    $first: Int
    $cursor: Cursor
    $condition: ActivityCondition
    $orderBy: [ActivitiesOrderBy!] = OCCURRED_AT_DESC
  ) {
    activityFeedItems(
      first: $first
      after: $cursor
      condition: $condition
      orderBy: $orderBy
    ) {
      edges {
        node {
          ...Activity
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * API used by activity feed page.
 * @returns {Promise<[Transaction]>}
 */
async function activityFeedItems(accountIds, startDate) {
  let transactions = [];
  let hasNextPage = true;
  let cursor = undefined;
  while (hasNextPage) {
    let respJson = await GM.xmlHttpRequest({
      url: "https://my.wealthsimple.com/graphql",
      method: "POST",
      responseType: "json",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getOauthCookie().access_token}`,
      },
      data: JSON.stringify({
        operationName: "FetchActivityFeedItems",
        query: `
            ${fetchActivityFeedItemsQuery}
            ${activityFeedItemFragment}
        `,
        variables: {
          first: 100,
          cursor,
          condition: {
            startDate,
            accountIds,
            unifiedStatuses: ["COMPLETED"],
          },
        },
      }),
    });

    if (respJson.status !== 200) {
      throw `Failed to fetch transactions: ${respJson.responseText}`;
    }
    let resp = JSON.parse(respJson.responseText);
    let activities = resp.data.activityFeedItems;
    hasNextPage = activities.pageInfo.hasNextPage;
    cursor = activities.pageInfo.endCursor;
    transactions = transactions.concat(activities.edges.map((e) => e.node));
  }
  return transactions;
}

const fetchAllAccountFinancialsQuery = `
  query FetchAllAccountFinancials(
    $identityId: ID!
    $pageSize: Int = 25
    $cursor: String
  ) {
    identity(id: $identityId) {
      id
      accounts(filter: {}, first: $pageSize, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            ...Account
          }
        }
      }
    }
  }

  fragment Account on Account {
    id
    unifiedAccountType
    nickname
  }
`;

/**
 * @typedef {Object} AccountInfo
 * @property {string} id
 * @property {string} nickname
 */

/**
 * Query all accounts
 * @returns {Promise<[AccountInfo]>}
 */
async function accountFinancials() {
  let oauthCookie = getOauthCookie();
  let respJson = await GM.xmlHttpRequest({
    url: "https://my.wealthsimple.com/graphql",
    method: "POST",
    responseType: "json",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${oauthCookie.access_token}`,
    },
    data: JSON.stringify({
      operationName: "FetchAllAccountFinancials",
      query: fetchAllAccountFinancialsQuery,
      variables: {
        identityId: oauthCookie.identity_canonical_id,
        pageSize: 25,
      },
    }),
  });

  if (respJson.status !== 200) {
    throw `Failed to fetch account info: ${respJson.responseText}`;
  }
  let resp = JSON.parse(respJson.responseText);
  const self_directed_re = /^SELF_DIRECTED_(?<name>.*)/;
  let accounts = resp.data.identity.accounts.edges.map((e) => {
    let nickname = e.node.nickname;
    if (!nickname) {
      if (e.node.unifiedAccountType === "CASH") {
        nickname = "Cash";
      } else if (self_directed_re.test(e.node.unifiedAccountType)) {
        let found = e.node.unifiedAccountType.match(self_directed_re);
        nickname = found.groups.name;
        if (nickname === "CRYPTO") {
          nickname = "Crypto";
        } else if (nickname === "NON_REGISTERED") {
          nickname = "Non-registered";
        }
      } else {
        nickname = "Unknown";
      }
    }
    return {
      id: e.node.id,
      nickname,
    };
  });
  return accounts;
}

/**
 * @typedef {Object} TransferInfo
 * @property {string} id
 * @property {string} status
 * @property {{"bankAccount": BankInfo}} source
 * @property {{"bankAccount": BankInfo}} destination
 */

/**
 * @typedef {Object} BankInfo
 * @property {string} accountName
 * @property {string} accountNumber
 * @property {string} institutionName
 * @property {string} nickname
 */

const fetchFundsTransferQuery = `
  query FetchFundsTransfer($id: ID!) {
    fundsTransfer: funds_transfer(id: $id, include_cancelled: true) {
      id
      status
      source {
        ...BankAccountOwner
      }
      destination {
        ...BankAccountOwner
      }
    }
  }

  fragment BankAccountOwner on BankAccountOwner {
    bankAccount: bank_account {
      id
      institutionName: institution_name
      nickname
      ...CaBankAccount
      ...UsBankAccount
    }
  }

  fragment CaBankAccount on CaBankAccount {
    accountName: account_name
    accountNumber: account_number
  }

  fragment UsBankAccount on UsBankAccount {
    accountName: account_name
    accountNumber: account_number
  }
`;

/**
 * @param {string} transferId
 * @returns {Promise<TransferInfo>}
 */
async function fundsTransfer(transferId) {
  let respJson = await GM.xmlHttpRequest({
    url: "https://my.wealthsimple.com/graphql",
    method: "POST",
    responseType: "json",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOauthCookie().access_token}`,
    },
    data: JSON.stringify({
      operationName: "FetchFundsTransfer",
      query: fetchFundsTransferQuery,
      variables: {
        id: transferId,
      },
    }),
  });

  if (respJson.status !== 200) {
    throw `Failed to fetch transfer info: ${respJson.responseText}`;
  }
  let resp = JSON.parse(respJson.responseText);
  return resp.data.fundsTransfer;
}

/**
 * @param {[Transaction]} transactions
 * @returns {Promise<{[string]: Blob}>}
 */
async function transactionsToCsvBlobs(transactions) {
  let accTransactions = transactions.reduce((acc, transaction) => {
    const id = transaction.accountId;
    (acc[id] = acc[id] || []).push(transaction);
    return acc;
  }, {});
  let accBlobs = {};
  for (let acc in accTransactions) {
    accBlobs[acc] = await accountTransactionsToCsvBlob(accTransactions[acc]);
  }
  return accBlobs;
}

/**
 * @param {[Transaction]} transactions
 * @returns {Promise<Blob>}
 */
async function accountTransactionsToCsvBlob(transactions) {
  let csv = `"Date","Payee","Notes","Category","Amount"\n`;
  for (const transaction of transactions) {
    let date = new Date(transaction.occurredAt);
    // JS Date type is absolutly horible, I hope Temporal API will be better
    let dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    let payee = null;
    let notes = null;
    let type = transaction.type;
    if (transaction.subType) {
      type = `${type}/${transaction.subType}`;
    }

    // Most transactions in Wealthsimple don't have category, skipping
    let category = "";

    switch (type) {
      case "INTEREST":
        payee = "Wealthsimple";
        notes = "Interest";
        break;
      case "WITHDRAWAL/E_TRANSFER":
        payee = transaction.eTransferEmail;
        notes = `INTERAC e-Transfer to ${transaction.eTransferName}`;
        break;
      case "DIVIDEND/DIY_DIVIDEND":
        payee = transaction.assetSymbol;
        notes = `Received dividend from ${transaction.assetSymbol}`;
        break;
      case "DIY_BUY/DIVIDEND_REINVESTMENT":
        payee = transaction.assetSymbol;
        notes = `Reinvested dividend into ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "DIY_BUY/MARKET_ORDER":
        payee = transaction.assetSymbol;
        notes = `Bought ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "DEPOSIT/AFT":
        payee = transaction.aftOriginatorName;
        notes = `Direct deposit from ${transaction.aftOriginatorName}`;
        category = transaction.aftTransactionCategory;
        break;
      case "DEPOSIT/EFT":
        let info = await fundsTransfer(transaction.externalCanonicalId);
        let bankInfo = info.source.bankAccount;
        payee = `${bankInfo.institutionName} ${bankInfo.nickname || bankInfo.accountName} ${bankInfo.accountNumber || ""}`;
        notes = `Direct deposit from ${payee}`;
        break;
      default:
        console.log(
          `${dateStr} transaction [${type}] has unexpected type. Object logged below. Skipping`,
        );
        console.log(transaction);
        continue;
    }

    let amount = transaction.amount;
    if (transaction.amountSign === "negative") {
      amount = `-${amount}`;
    }

    let entry = `"${dateStr}","${payee}","${notes}","${category}","${amount}"`;
    csv += `${entry}\n`;
  }
  return new Blob([csv], { type: "text/csv" });
}

/**
 * @param {{[string]: Blob}} accountBlobs
 * @param {[AccountInfo]} accountsInfo
 * @param {Date?} fromDate
 */
function saveBlobsToFiles(accountBlobs, accountsInfo, fromDate) {
  let accToName = accountsInfo.reduce((accum, info) => {
    accum[info.id] = info.nickname;
    return accum;
  }, {});

  for (let acc in accountBlobs) {
    let blobUrl = URL.createObjectURL(accountBlobs[acc]);

    let now = new Date();
    let nowStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    let timeFrame = "";
    if (fromDate) {
      timeFrame += `From ${fromDate.getFullYear()}-${fromDate.getMonth() + 1}-${fromDate.getDate()} `;
    }
    timeFrame += `Up to ${nowStr}`;

    let link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Wealthsimple ${accToName[acc]} Transactions ${timeFrame}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
}
