## Java Dependency Upgrader (JDU)

#### Config (config.json)

- server: **string**. Options available: github & bitbucket.
- serverToken: **string**
- serverOwner: **string**
- disableSSL: **boolean** - default to false
- dependencyName: **string**
- dependencyVersion: **string**
- repositories: **array** of **objects**
  - url: **string**. Example: _"yourserver.com/bitbucket/scm/myRepository/main.git"_
  - originBranch: **string**
  - destinyBranch (Optional): **string**
  - artifactVersion (Optional): **string**
- tempDirName (Optional): **string** - default to homedir
- powerShellPath (Only for Windows): **string** - default to undefined. Example: _"C:/Windows/SysWOW64/WindowsPowerShell/v1.0/powershell.exe"_
- shellMode (Optional, not recommended): **boolean** - default to false
- replaceShellTag (Only if artifact version is set and shell mode is true): **string** - default to undefined. Example: _"PROJECT.VERSION"_

#### FAQ

- How to generate a Github token ?
  https://docs.github.com/es/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

- How to generate a Bitbucket token ?
  https://confluence.atlassian.com/bitbucketserver/http-access-tokens-939515499.html

- How to use the artifact version ?
  WIP

- What is shell mode ?
  WIP
