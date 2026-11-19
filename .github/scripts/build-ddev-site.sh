#!/usr/bin/env bash
# Builds the learning site the suite runs against: the release package of the
# current stable release (5.3), installed by its own command-line installer in a
# DDEV project of type php, with the default theme (Boost), its data folder
# outside the web root, cron running in the web container, the test course and
# the accounts.
#
# The project folder holds three things: moodle/ (the release package), its
# data folder moodledata/ beside it, and nothing else of the site, so a test
# project (cucumber.js, package.json, tests/) can live at the top without
# touching the package's own package.json. A release with a public/ folder
# (5.1 and later) is served from moodle/public; an older one (4.5) from moodle/.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME      the DDEV project name                         (default moodlesteps)
#   SITE_DIR          the project folder                            (default a new temporary folder)
#   MOODLE_BRANCH     the stable branch: 503 for 5.3, 405 for 4.5   (default 503)
#   MOODLE_VERSION    a point release of that branch, e.g. 5.3.1     (default the latest of the branch)
#   PHP_VERSION       the PHP of the web container                  (default 8.3)
#   DATABASE          the database of the project                   (default mariadb:11.4)
#   ACCOUNT_PASSWORD  the password of every account below           (default dD.123123ddd)
#   ACCOUNTS_ONLY     1: build nothing; give the accounts of the site in SITE_DIR
#                     back their name, address, password, roles and enrolments
#                     (after a run that was stopped half way)
#   COURSE_ONLY       1: build nothing; make the test course of the site in
#                     SITE_DIR again from nothing, and enrol the accounts again
#
# The accounts are configuration: this script creates them and cucumber.js names
# them; the features never create or delete users.
#   administrator  administrator@example.com  site administrator (the installer's account)
#   manager        manager@example.com        the Manager role on the whole site
#   teacher        teacher@example.com        Teacher (editing) in the test course
#   student        student@example.com        Student in the test course
#   student2       student2@example.com       not enrolled (self enrolment with the key)
#
# Nothing is installed that the release package does not bring: no plugin from
# outside it, no paid service, no sign-in to any account.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-moodlesteps}"
MOODLE_BRANCH="${MOODLE_BRANCH:-503}"
MOODLE_VERSION="${MOODLE_VERSION:-}"
PHP_VERSION="${PHP_VERSION:-8.3}"
DATABASE="${DATABASE:-mariadb:11.4}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

# Run the test site's own PHP script (site/test-site.php) in the web container
# with the arguments given; the script is in the project only for that call.
test_site() {
  cp "$REPO_DIR/site/test-site.php" "$SITE_DIR/.test-site.php"
  local status=0
  ddev exec php /var/www/html/.test-site.php --config=/var/www/html/moodle/config.php "$@" </dev/null || status=$?
  rm -f "$SITE_DIR/.test-site.php"
  return $status
}

# The accounts (see the header).
write_accounts() {
  python3 -c '
import json, sys
password = sys.argv[1]
def account(name, first, last, **role):
    return dict(username=name, email=name + "@example.com", firstname=first, lastname=last, password=password, **role)
print(json.dumps([
    account("administrator", "Administrator", "User", siteadmin=True),
    account("manager", "Manager", "User", systemrole="manager"),
    account("teacher", "Teacher", "User", courserole="editingteacher"),
    account("student", "Student", "User", courserole="student"),
    account("student2", "Student2", "User"),
]))' "$ACCOUNT_PASSWORD" > "$SITE_DIR/.test-accounts.json"
  local status=0
  test_site --accounts=/var/www/html/.test-accounts.json || status=$?
  rm -f "$SITE_DIR/.test-accounts.json"
  return $status
}

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  write_accounts
  exit 0
fi
if [ "${COURSE_ONLY:-}" = "1" ]; then
  test_site --course
  write_accounts
  exit 0
fi

# The release package of the branch, from the project's download site.
if [ -n "$MOODLE_VERSION" ]; then
  PACKAGE="moodle-${MOODLE_VERSION}.tgz"
else
  PACKAGE="moodle-latest-${MOODLE_BRANCH}.tgz"
fi
PACKAGE_URL="https://download.moodle.org/download.php/direct/stable${MOODLE_BRANCH}/${PACKAGE}"

# The web server type of the documented DDEV way (Apache hands a script the path
# after its name, which the file and theme addresses use), the database the
# release needs (5.3: MariaDB 11.4 or later), and Node.js 24, the line of the
# Webship Workspace (the site itself needs none).
ddev config --project-type=php --docroot=moodle/public --webserver-type=apache-fpm \
  --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION" --database="$DATABASE" --nodejs-version=24

# PHP settings the installer checks: at least 5000 input variables.
mkdir -p .ddev/php
cat > .ddev/php/moodle.ini <<'INIEOF'
max_input_vars = 5000
INIEOF

# Cron, as the site asks for it: admin/cli/cron.php again and again, in the web
# container, run by the container's own process supervisor once the site is
# installed. Each run keeps polling for new tasks for a minute; a run that
# cannot start yet (no site, an install going on) is tried again ten seconds later.
cat > .ddev/cron.sh <<'CRONEOF'
#!/usr/bin/env bash
while true; do
  if [ -f /var/www/html/moodle/config.php ]; then
    php /var/www/html/moodle/admin/cli/cron.php --keep-alive=60 >> /tmp/cron.log 2>&1 || sleep 10
  else
    sleep 10
  fi
done
CRONEOF
cat > .ddev/config.cron.yaml <<'CRONEOF'
web_extra_daemons:
  - name: "cron"
    command: "bash /var/www/html/.ddev/cron.sh"
    directory: /var/www/html
CRONEOF

ddev start -y

# The code in moodle/, unpacked in the web container; the data folder beside it.
ddev exec "rm -rf /var/www/html/moodle /tmp/moodle && curl -fsSL '$PACKAGE_URL' -o /tmp/moodle.tgz && tar -xzf /tmp/moodle.tgz -C /tmp && rm /tmp/moodle.tgz && mv /tmp/moodle /var/www/html/moodle && mkdir -p /var/www/html/moodledata" </dev/null
DOCROOT=moodle/public
if ! ddev exec test -f /var/www/html/moodle/public/version.php </dev/null; then
  # A release before 5.1 has no public/ folder: it is served from moodle/.
  DOCROOT=moodle
  ddev config --docroot=moodle
  ddev restart -y
fi

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

# The release's own installer: moodle/config.php, the database, the administrator.
ddev exec php /var/www/html/moodle/admin/cli/install.php --non-interactive --agree-license --lang=en \
  --wwwroot="$SITE_URL" --dataroot=/var/www/html/moodledata \
  --dbtype=mariadb --dbhost=db --dbname=db --dbuser=db --dbpass=db --prefix=mdl_ \
  --fullname="Learning site" --shortname="learning" --summary="The site the test suite runs against." \
  --adminuser=administrator --adminpass="$ACCOUNT_PASSWORD" --adminemail=administrator@example.com \
  --supportemail=support@example.com </dev/null
# The no-reply address through the site's own settings tool: the installer of the 4.5 line has no option for it.
ddev exec php /var/www/html/moodle/admin/cli/cfg.php --name=noreplyaddress --set=noreply@example.com </dev/null

# The test site: its settings, the test course, the accounts.
test_site --settings
test_site --course
write_accounts

# The first cron run, so that the scheduled tasks of a new site have run once.
ddev exec php /var/www/html/moodle/admin/cli/cron.php </dev/null > /dev/null 2>&1 || true

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
RELEASE="$(ddev exec php /var/www/html/moodle/admin/cli/cfg.php --name=release </dev/null 2>/dev/null || true)"
echo "Built ${RELEASE:-the release} (docroot ${DOCROOT}) at $SITE_URL"
