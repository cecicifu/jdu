import fs from "fs"
import xml2js from "xml2js"

export async function replaceDependencyVersion(
	repositoryLocalPath,
	dependencyName,
	dependencyVersion,
	artifactVersion
) {
	const data = fs.readFileSync(repositoryLocalPath, "utf-8")

	const jsonData = await xml2js.parseStringPromise(data)

	const changesInDependencyManagement = searchInDependencyManagement(
		jsonData,
		dependencyName,
		dependencyVersion
	)
	const changesInPluginManagement = searchInPluginManagement(
		jsonData,
		dependencyName,
		dependencyVersion
	)

	if (
		!changesInDependencyManagement &&
		!changesInPluginManagement &&
		!artifactVersion
	)
		return

	if (artifactVersion) changeArtifactVersion(jsonData, artifactVersion)

	const builder = new xml2js.Builder()
	const xml = builder.buildObject(jsonData)

	fs.writeFileSync(repositoryLocalPath, xml)
}

function searchInDependencyManagement(
	result,
	dependencyName,
	dependencyVersion
) {
	let changed = false

	if (!result.project.dependencyManagement) return changed

	result.project.dependencyManagement[0].dependencies[0].dependency.forEach(
		(dependency) => {
			if (dependency.artifactId[0] !== dependencyName) return

			if (getVariableVersion(result, dependency, dependencyVersion)) {
				changed = true
				return
			}

			dependency.version[0] = dependencyVersion

			changed = true
		}
	)

	return changed
}

function searchInPluginManagement(result, dependencyName, dependencyVersion) {
	let changed = false

	if (!result.project.build || !result.project.build[0].pluginManagement)
		return changed

	result.project.build[0].pluginManagement[0].plugins.forEach((pluginArray) => {
		const plugin = pluginArray.plugin[0]

		if (plugin.artifactId[0] !== dependencyName && !plugin.dependencies) return

		// TODO: optimize recursive search
		// Recursive search on plugin dependencies
		let existsInRecursive = false
		if (plugin.dependencies) {
			plugin.dependencies[0].dependency.forEach((pluginDependency) => {
				if (pluginDependency.artifactId[0] !== dependencyName) return
				existsInRecursive = true

				if (getVariableVersion(result, pluginDependency, dependencyVersion)) {
					changed = true
					return
				}

				pluginDependency.version[0] = dependencyVersion

				changed = true
			})
		}

		if (!existsInRecursive) {
			if (plugin.artifactId[0] !== dependencyName) return

			if (getVariableVersion(result, plugin)) {
				changed = true
				return
			}

			plugin.version[0] = dependencyVersion

			changed = true
		}
	})

	return changed
}

function getVariableVersion(result, objectToEdit, dependencyVersion) {
	if (objectToEdit.version[0].startsWith("$")) {
		const versionVariable = objectToEdit.version[0].slice(
			2,
			objectToEdit.version[0].length - 1
		)
		result.project.properties[0][versionVariable][0] = dependencyVersion

		return true
	}

	return false
}

function changeArtifactVersion(jsonData, artifactVersion) {
	if (jsonData.project.version) {
		const prevVersion = jsonData.project.version[0]
		jsonData.project.version[0] = artifactVersion

		if (jsonData.project.parent[0]?.version[0] === prevVersion) {
			jsonData.project.parent[0].version[0] = artifactVersion
		}
	} else {
		if (jsonData.project.parent[0].version) {
			jsonData.project.parent[0].version[0] = artifactVersion
		}
	}
}
