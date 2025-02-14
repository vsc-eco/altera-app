import moment from 'moment';

const noiseScaled = (scale: number) => {
	return (i: number) => {
		const s = Math.log(scale * 10);
		i /= scale;
		return s * (Math.sin(2 * i) + Math.sin(Math.PI * i)) + s * 2;
	};
};

const noiseScales = [1, 2, 4, 8, 16, 32, 64, 128, 256].map(noiseScaled);

const values = [...Array(400)].map((_, i) => {
	return noiseScales.reduce((sum, fn) => {
		return sum + fn(i);
	}, 0);
});
export const defaultData = values.map((data, idx) => {
	const start = moment().subtract(399, 'days').toDate();
	const out = new Date(start.setDate(start.getDate() + idx));
	return {
		value: data,
		date: out
	};
});
