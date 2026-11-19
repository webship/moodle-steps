'use strict';

// The session: logging in by a handle of the users registry or by a user name
// and a password, the guest access, logging out, who is signed in, and the
// login form.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and created once by the build of the site. A
// feature never creates or deletes users.
//
// This file also puts the toast recorder on every page of the run (see
// moodle-helpers.js): a toast closes by itself, and the message steps read it
// after it did.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly, onNewPage } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  same,
  currentPath,
  pathOf,
  failure,
  afterAction,
  personClick,
  toastRecorder,
  requests,
  resolveUser,
  loginPath,
  loginForm,
  signedInState,
  whoIsSignedIn,
  LOGIN_HINT,
  openLoginForm,
  submitLogin,
  loginThroughTheForm,
  logInAs,
  forgetSession,
  CUT_REQUEST_HINT,
} = require('./moodle-helpers');

onNewPage(async (world, page) => {
  await page.addInitScript(toastRecorder);
  // The requests a page sends on its own are counted from the moment it opens (see pageReady).
  requests(page);
});

/**
 * Log in as an account of the users registry (`worldParameters.users` in
 * cucumber.js), by its handle. An account that logged in earlier in the run
 * takes its session over; otherwise the step logs in through the login form.
 * The browser ends on the page the site shows after a login (the Dashboard).
 *
 * Example #1: Given I am a logged in user with the "student" user
 * Example #2: Given we are a logged in user with the "teacher" user
 * Example #3: Given I am a logged in user with "administrator"
 * Example #4: And I am a logged in user with the "manager" user
 * Example #5: Given we are a logged in user with the "student2" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await logInAs(this, handle);
});

/**
 * Log in through the login form as an account of the users registry, as a
 * person does: a new session, never one taken over. For the scenarios that
 * test the form itself; the step fails when the site refuses the login.
 *
 * Example #1: When I log in as "student" with the login form
 * Example #2: When we log in as "teacher" with the login form
 * Example #3: And I log in as "administrator" with the login form
 * Example #4: When I log in as "manager" with the login form
 * Example #5: When we log in as "student2" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  const outcome = await loginThroughTheForm(this, user);
  if (outcome.error) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.username}): ${outcome.error}`,
      hint: outcome.cut ? CUT_REQUEST_HINT : 'Check the user name and the password of the account in worldParameters.users, and that the build of the site created the account.',
    });
  }
  this.__signedInAs = handle;
});

/**
 * Send the login form with a user name (or an address) and a password. The
 * step does not expect the login to succeed: assert the outcome with the next
 * step (the error message of the login page, who is logged in).
 *
 * Example #1: When I log in with the username "student" and the password "wrong-password"
 * Example #2: When we log in with the username "nobody" and the password "Whatever-123!"
 * Example #3: When I log in with the username "student@example.com" and the password "wrong-password"
 * Example #4: And I log in with the username "" and the password "wrong-password"
 * Example #5: When we log in with the username "no-such-account" and the password "Nothing-at-all-1!"
 */
When(/^(I |we )*log in with the username "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  await submitLogin(this, username, password);
});

/**
 * Log in as a guest, as a person does: the "Log in as guest" button of the
 * login page (shown when the site allows guest access).
 *
 * Example #1: When I log in as a guest
 * Example #2: When we log in as a guest
 * Example #3: And I log in as a guest
 * Example #4: Given I log in as a guest
 * Example #5: Then I log in as a guest
 */
When(/^(I |we )*log in as a guest$/, { timeout: 120000 }, async function (pronounCase) {
  await openLoginForm(this);
  const button = this.page.getByRole('button', { name: /log in as (a )?guest|access as (a )?guest/i }).filter({ visible: true });
  if (!(await button.count())) {
    throw failure(this, `The login page has no guest login button (${this.page.url()}).`, 'The site shows it when its "Guest login button" setting is "Show" (Site administration, Users, Authentication).');
  }
  await afterAction(this, () => personClick(button.first()));
  this.__signedInAs = 'guest';
});

/**
 * Log out as a person does: the user menu of the page, then its "Log out"
 * item. The session ends on the server, so no later scenario takes it over.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, async function (pronounCase) {
  const page = this.page;
  if (!(await page.locator('#user-menu-toggle').count())) await whoIsSignedIn(this);
  const toggle = page.locator('#user-menu-toggle');
  if (!(await toggle.count())) {
    throw failure(this, `Nobody is logged in: the page has no user menu (${page.url()}).`, 'Log in first (I am a logged in user with the "..." user).');
  }
  await personClick(toggle);
  const item = page.getByRole('menuitem', { name: /^\s*log out\s*$/i });
  try {
    await item.waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    throw failure(this, 'The user menu opened without a "Log out" item.', 'The user menu lists Profile, Grades, Calendar, Private files, Reports, Preferences and Log out.');
  }
  forgetSession(this);
  await afterAction(this, () => item.click());
  this.__signedInAs = null;
});

/**
 * Assert that somebody is, or nobody is, logged in (a guest is nobody). The
 * step opens the Dashboard and reads the user menu of the page.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: Then we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: But I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const state = await whoIsSignedIn(this);
  if (notCase && state.state === 'user') {
    throw failure(this, `Expected nobody to be logged in, but the user menu names "${state.name}".`, 'Log out first (I log out), or start from a new visitor (I am an anonymous user).');
  }
  if (!notCase && state.state !== 'user') {
    throw failure(this, `Expected to be logged in, but ${state.state === 'guest' ? 'the page says guest access is used' : `the Dashboard sent the browser to ${currentPath(this)}: nobody is signed in`}.`, 'Log in first (I am a logged in user with the "..." user).');
  }
});

/**
 * Assert who is logged in, by a handle of the users registry: the user menu
 * names the account by its full name (`name` in the registry, else its user
 * name).
 *
 * Example #1: Then I should be logged in as "student"
 * Example #2: Then we should be logged in as "teacher"
 * Example #3: And I should be logged in as "administrator"
 * Example #4: Then I should be logged in as "manager"
 * Example #5: And we should be logged in as "student2"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  const state = await whoIsSignedIn(this);
  if (state.state !== 'user') {
    throw failure(this, `Expected "${handle}" to be logged in, but ${state.state === 'guest' ? 'the page says guest access is used' : 'nobody is signed in'}.`, 'Log in first (I am a logged in user with the "..." user).');
  }
  const expected = user.name || user.shown;
  if (expected ? !same(state.name, expected) : !clean(state.name).toLowerCase().includes(user.username.toLowerCase())) {
    throw failure(this, `Expected "${handle}"${expected ? ` (${expected})` : ''} to be logged in, but the user menu names "${state.name}".`, `Set the full name of the account as worldParameters.users.${handle}.name in cucumber.js.`);
  }
});

/**
 * Assert that the browser uses, or does not use, guest access: the user menu
 * of the page says "You are currently using guest access".
 *
 * Example #1: Then I should be logged in as a guest
 * Example #2: Then I should not be logged in as a guest
 * Example #3: And we should be logged in as a guest
 * Example #4: Then we should not be logged in as a guest
 * Example #5: But I should not be logged in as a guest
 */
Then(/^(I |we )*should( not)* be logged in as a guest$/, async function (pronounCase, notCase) {
  let state = await signedInState(this);
  if (state.state === 'unknown' || state.state === 'visitor') state = await whoIsSignedIn(this);
  if (notCase && state.state === 'guest') {
    throw failure(this, 'Expected no guest access, but the page says "You are currently using guest access".', 'Log out first (I log out).');
  }
  if (!notCase && state.state !== 'guest') {
    throw failure(this, `Expected guest access, but ${state.state === 'user' ? `the user menu names "${state.name}"` : 'nobody is signed in'}.`, 'Log in as a guest first (I log in as a guest).');
  }
});

/**
 * Assert that the page shows, or does not show, the login form (a user name
 * field, a password field and a button), for instance after a page that needs
 * a session sent a visitor to it.
 *
 * Example #1: Then I should see the login form
 * Example #2: Then I should not see the login form
 * Example #3: And we should see the login form
 * Example #4: Then we should not see the login form
 * Example #5: But I should see the login form
 */
Then(/^(I |we )*should( not)* see the login form$/, async function (pronounCase, notCase) {
  const form = loginForm(this);
  try {
    await form.waitFor({ state: notCase ? 'hidden' : 'visible', timeout: budget(this) });
  } catch {
    throw failure(this, notCase ? `Expected no login form, but the page shows one (${this.page.url()}).` : `Expected the login form, but the page is ${this.page.url()} ("${clean(await this.page.title())}").`, LOGIN_HINT);
  }
  if (!notCase && currentPath(this) !== pathOf(loginPath(this))) {
    throw failure(this, `A login form is on the page, but the page is ${currentPath(this)}, not ${loginPath(this)}.`, 'Check worldParameters.loginPath in cucumber.js.');
  }
});
