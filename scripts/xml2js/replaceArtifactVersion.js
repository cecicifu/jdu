import fs from "fs"
import xml2js from "xml2js"

export async function replaceArtifactVersion(pomUrl, artifactVersion) {
	const data = fs.readFileSync(pomUrl, "utf-8")

	const jsonData = await xml2js.parseStringPromise(data)

	if (!jsonData.project.version) return

	jsonData.project.version[0] = artifactVersion

	const builder = new xml2js.Builder()
	const xml = builder.buildObject(jsonData)

	fs.writeFileSync(pomUrl, xml)
}
