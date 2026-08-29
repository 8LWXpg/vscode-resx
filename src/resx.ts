import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export type XmlData = {
	'@_name': string;
	value: string;
	comment?: string;
};

export class ResXParser extends XMLParser {
	constructor() {
		super({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			trimValues: false,
			isArray: (tagName) => tagName === 'data',
			numberParseOptions: {
				leadingZeros: false,
				hex: false,
				skipLike: /.*/,
			},
		});
	}

	public parse(resxData: string): XmlData[] {
		const data: XmlData[] = super.parse(resxData).data;
		data.forEach((obj) => {
			delete obj['@_xml:space'];
			delete obj['#text'];
		});

		return data;
	}
}

export class ResXBuilder extends XMLBuilder {
	private readonly lineEnding: string;

	constructor(indent: string, lineEnding: string) {
		super({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			format: true,
			indentBy: indent,
			suppressEmptyNode: true,
		});
		this.lineEnding = lineEnding;
	}

	public build(data: XmlData[]): string {
		if (data.length === 0) {
			return '';
		}
		data.forEach((obj) => {
			obj['@_xml:space'] = 'preserve';
		});
		const formatted: string = super.build({ a: { data: data } });
		// replace '\n' it with the document line ending
		// resx supports " and ' without escaping
		return formatted
			.slice('<a>\n'.length, -'</a>\n'.length)
			.replaceAll('&quot;', '"')
			.replaceAll('&apos;', "'")
			.replaceAll('\n', this.lineEnding);
	}
}
