import mainnetSampleData from './mainnetSampleData';
export default function getSampleData(did: string) {
	return mainnetSampleData.filter((value) => {
		return value.required_auths[0] == did;
	});
}
