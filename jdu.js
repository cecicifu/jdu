import { execSync, spawnSync } from "node:child_process"
import { homedir } from "os"
import { readFile } from "fs/promises"
import { replaceDependencyVersion } from "./scripts/xml2js/replaceDependencyVersion.js"
import { setTimeout as sleep } from "node:timers/promises"
import ora from "ora"

// read config json with this way for compatibility with older node versions
const config = JSON.parse(
	await readFile(new URL("./config.json", import.meta.url))
)

// current script directory
const CURRENT_DIR = process.cwd()
const TEMP_DIR_NAME = config.tempDirName ?? ".jdu"
const REQUIRED_NODE_VERSION = 14
const SLEEP_TIME = 1000
const SERVERS = {
	github: "github",
	bitbucket: "bitbucket",
}

const disableSSL = config.disableSSL ? "-c http.sslVerify=false" : ""

function execCommand(cmd, args = undefined) {
	const shell = process.platform === "win32" ? config.powerShellPath : undefined

	const response = spawnSync(cmd, args, {
		encoding: "utf-8",
		shell,
	})

	return response
}

async function checkRequirements() {
	const requirementsSpinner = ora("Checking requirements..").start()

	await sleep(SLEEP_TIME)

	const nodeVersion = process.version.split("v")[1]
	const majorNodeVersion = Number(nodeVersion.split(".")[0])

	if (majorNodeVersion < REQUIRED_NODE_VERSION) {
		requirementsSpinner.warn(
			`Using a node version lower than ${REQUIRED_NODE_VERSION} could cause problems\n`
		)
	}

	if (
		!config.server ||
		!config.serverToken ||
		!config.serverOwner ||
		!config.dependencyName ||
		!config.dependencyVersion ||
		config.repositories.length === 0
	) {
		requirementsSpinner
			.fail("First off, needs to provide the config params")
			.stop()
		process.exit(1)
	}

	if (!Object.keys(SERVERS).includes(config.server)) {
		requirementsSpinner.fail("The selected server is not valid").stop()
		process.exit(1)
	}

	// Only Windows
	if (process.platform === "win32" && !config.powerShellPath) {
		requirementsSpinner.fail("No Powershell path provided").stop()
		process.exit(1)
	}

	requirementsSpinner.succeed("Requirements\n").stop()
}

function extractRepositoryNameFromUrl(url) {
	const urlParts = url.split("/")
	const repositoryName = urlParts[urlParts.length - 1].split(".")[0]

	return repositoryName
}

async function replaceXML(repositoryLocalPath, repository) {
	const replaceXMLSpinner = ora("Upgrading versions..").start()

	await sleep(SLEEP_TIME)

	if (!config.shellMode) {
		try {
			const command = execCommand(`find ${repositoryLocalPath} -name pom.xml`)
			command.stdout
				.trim()
				.split(/\r?\n/)
				.forEach((pomUrl) => {
					replaceDependencyVersion(
						pomUrl,
						config.dependencyName,
						config.dependencyVersion,
						repository.artifactVersion
					)
				})
		} catch (error) {
			replaceXMLSpinner
				.fail("\nSome error ocurred while reading the file")
				.stop()

			process.exit(1)
		}
	} else {
		execCommand("sh ./scripts/replace_dependency_version.sh", [
			repositoryLocalPath,
			config.dependencyName,
			config.dependencyVersion,
		])

		if (repository.artifactVersion) {
			if (!config.replaceShellTag) {
				replaceXMLSpinner.warn("No replace shell tag provided")
				return
			}

			execCommand("sh ./scripts/replace_artifact_version.sh", [
				repositoryLocalPath,
				config.REPLACE_SHELL_TAG,
				repository.artifactVersion,
			])
		}
	}

	replaceXMLSpinner.succeed("Version upgraded").stop()
}

async function init() {
	console.time("Execution time")

	console.info("\nWelcome to \x1b[36mJava Dependency Upgrader\x1b[0m.\n")

	await checkRequirements()

	console.info("Organization:\x1b[1m", config.serverOwner, "\x1b[0m")
	console.info("Dependency name:\x1b[1m", config.dependencyName, "\x1b[0m")
	console.info(
		"Dependency version:\x1b[1m",
		config.dependencyVersion,
		"\x1b[0m"
	)
	console.info("\nThis process may take a while, be patience please.")

	process.chdir(homedir())

	execSync(`rm -rf ${TEMP_DIR_NAME}`)
	execSync(`mkdir ${TEMP_DIR_NAME}`)

	for (const repository of config.repositories) {
		process.chdir(`${homedir}/${TEMP_DIR_NAME}`)

		const repositoryName = extractRepositoryNameFromUrl(repository.url)

		execSync(`rm -rf ${repositoryName}`)

		console.info("\nRepository:\x1b[1m", repository.url, "\x1b[0m\n")

		const firstProcessSpinner = ora("Cloning repository..\n").start()

		await sleep(SLEEP_TIME)

		if (config.server === SERVERS.github) {
			execCommand(
				`git clone --quiet https://${config.serverToken}@github.com/${config.serverOwner}/${repositoryName}`
			)
		}

		if (config.server === SERVERS.bitbucket) {
			execCommand(
				`git ${disableSSL} clone --quiet https://${config.serverOwner}:${config.serverToken}@${repository.url}`
			)
		}

		process.chdir(`${homedir}/${TEMP_DIR_NAME}/${repositoryName}`)

		if (repository.destinyBranch) {
			firstProcessSpinner.text = "Checking if destiny branch exists on remote.."

			await sleep(SLEEP_TIME)

			const ls = execCommand(
				`git ${disableSSL} ls-remote origin ${repository.destinyBranch}`
			)
			if (ls.stdout) {
				process.chdir(`${homedir}/${TEMP_DIR_NAME}`)
				execSync(`rm -rf ${repositoryName}`)

				firstProcessSpinner
					.fail(
						`Destiny branch "${repository.destinyBranch}" for ${repositoryName} already exists in remote`
					)
					.stop()

				continue
			}

			firstProcessSpinner.text = "Creating branch.."

			await sleep(SLEEP_TIME)

			const checkout = execCommand(
				`git checkout --quiet -b ${repository.destinyBranch} ${repository.originBranch}`
			)
			if (checkout.stderr) {
				process.chdir(`${homedir}/${TEMP_DIR_NAME}`)
				execSync(`rm -rf ${repositoryName}`)

				firstProcessSpinner
					.fail(
						`Origin branch "${repository.originBranch}" for ${repositoryName} doesn't exists`
					)
					.stop()

				continue
			}
		}

		process.chdir(CURRENT_DIR)

		const repositoryLocalPath = `${homedir}/${TEMP_DIR_NAME}/${repositoryName}`

		firstProcessSpinner.stop()

		await replaceXML(repositoryLocalPath, repository)

		process.chdir(repositoryLocalPath)

		execCommand("git add .")

		const secondProcessSpinner = ora("Checking status..").start()

		await sleep(SLEEP_TIME)

		const status = execCommand(`git status`)
		if (status.stdout.includes("nothing to commit, working tree clean")) {
			process.chdir(`${homedir}/${TEMP_DIR_NAME}`)
			execSync(`rm -rf ${repositoryName}`)

			secondProcessSpinner.fail("No changes detected to commit").stop()

			continue
		}

		process.chdir(`${homedir}/${TEMP_DIR_NAME}/${repositoryName}`)

		execCommand(`git config user.email "contact@emeal.nttdata.com"`)
		execCommand(`git config user.name "JDU Bot"`)

		secondProcessSpinner.text = "Commiting changes.."

		await sleep(SLEEP_TIME)

		const commit = execCommand(
			`git commit -m "build(deps): Upgrade ${config.dependencyName} ${config.dependencyVersion}"`
		)
		if (commit.stderr) {
			process.chdir(`${homedir}/${TEMP_DIR_NAME}`)
			execSync(`rm -rf ${repositoryName}`)

			secondProcessSpinner.fail("Fail on commit. Check the log").stop()
		} else secondProcessSpinner.text = "Pushing changes.."

		await sleep(SLEEP_TIME)

		if (repository.destinyBranch) {
			const destinyPush = execCommand(
				`git ${disableSSL} push --quiet --set-upstream origin ${repository.destinyBranch}`
			)
			if (!destinyPush.stderr?.includes("pull request")) {
				process.chdir(`${homedir}/${TEMP_DIR_NAME}`)
				execSync(`rm -rf ${repositoryName}`)

				secondProcessSpinner.fail("Fail to push. Check the log").stop()
			} else secondProcessSpinner.succeed("Changes pushed").stop()

			await sleep(SLEEP_TIME)

			continue
		}

		const originPush = execCommand(
			`git ${disableSSL} push --quiet --set-upstream origin ${repository.originBranch}`
		)
		if (originPush.stderr) {
			process.chdir(`${homedir}/${TEMP_DIR_NAME}`)
			execSync(`rm -rf ${repositoryName}`)

			secondProcessSpinner.fail("Fail to push. Check the log").stop()
		} else secondProcessSpinner.succeed("Changes pushed").stop()

		await sleep(SLEEP_TIME)
	}

	console.info("\nCleaning cache..")
	console.info("\x1b[32m\x1b[1mDone!\x1b[0m\n")

	process.chdir(homedir())
	execSync(`rm -rf ${TEMP_DIR_NAME}`)

	console.timeEnd("Execution time")
}

init()
