import type { Response } from 'polka';
import { request } from 'undici';
import { CustomSourcesString } from '../types/discordjs-docs-parser';
import { PartialNpmAPIResponse } from '../types/npm';
import { logger, PREFIX_SUCCESS, prepareErrorResponse, prepareResponse } from '../util';

function formatVersionToRaw(version: string): string {
	return `https://raw.githubusercontent.com/discordjs/docs/main/discord.js/${version}.json`;
}

export async function loadLatestNpmVersion(customSources: Map<CustomSourcesString, string>): Promise<void> {
	const response = await request('https://registry.npmjs.org/discord.js');
	if (response.statusCode !== 200) {
		throw new Error('Failed to fetch latest npm version');
	}
	const json = (await response.body.json()) as PartialNpmAPIResponse;
	logger.info({
		versions: json['dist-tags'],
		msg: 'Fetched latest npm versions',
	});

	customSources.set('v13-lts', formatVersionToRaw(json['dist-tags']['v13-lts']));
	customSources.set('latest', formatVersionToRaw(json['dist-tags'].latest));

	for (const version of customSources.values()) {
		const response = await request(version);
		if (response.statusCode !== 200) {
			throw new Error(`Failed to verify source ${version}: ${response.statusCode}`);
		}
	}

	logger.info({
		msg: 'Loaded latest npm versions for discord.js',
		'v13-lts': customSources.get('v13-lts'),
		latest: customSources.get('latest'),
	});
}

export async function reloadNpmVersions(res: Response, customSources: Map<CustomSourcesString, string>) {
	const prev = {
		v13: customSources.get('v13-lts')!,
		latest: customSources.get('latest')!,
	};
	try {
		await loadLatestNpmVersion(customSources);

		const newVersions = {
			v13: customSources.get('v13-lts')!,
			latest: customSources.get('latest')!,
		};

		prepareResponse(
			res,
			`${PREFIX_SUCCESS} **Npm versions updated!**\nVersions: \n• v13-lts: \`${prev.v13}\` 🠚 \`${newVersions.v13}\`\n• Latest: \`${prev.latest}\` 🠚 \`${newVersions.latest}\``,
			true,
		);
	} catch (error) {
		logger.error(error as Error);
		prepareErrorResponse(
			res,
			`Something went wrong while updating npm-versions, reverting!\n\`${(error as Error).message}\``,
		);
		customSources.set('v13-lts', prev.v13);
		customSources.set('latest', prev.latest);
	}
	return res;
}
