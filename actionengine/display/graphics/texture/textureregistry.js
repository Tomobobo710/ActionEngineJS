class TextureRegistry {
	constructor() {
		this.textures = new Map();
		this.textureList = []; // Array to maintain texture order
		this.generateTextures();
	}

	generateTextures() {
		// Create textures in a specific order for indexing
		const grass = new ProceduralTexture(256, 256);
		grass.generateGrass();
		this.addTexture("grass", grass);

		const water = new ProceduralTexture(256, 256);
		water.generateWater();
		this.addTexture("water", water);

		const deepWater = new ProceduralTexture(256, 256);
		deepWater.generateDeepWater();
		this.addTexture("deepwater", deepWater);

		const sand = new ProceduralTexture(256, 256);
		sand.generateSand();
		this.addTexture("sand", sand);

		const dunes = new ProceduralTexture(256, 256);
		dunes.generateDunes();
		this.addTexture("dunes", dunes);

		const rock = new ProceduralTexture(256, 256);
		rock.generateRock();
		this.addTexture("rock", rock);

		const highland = new ProceduralTexture(256, 256);
		highland.generateHighlandGrass();
		this.addTexture("highland", highland);

		const treeline = new ProceduralTexture(256, 256);
		treeline.generateTreeline();
		this.addTexture("treeline", treeline);

		const snow = new ProceduralTexture(256, 256);
		snow.generateSnow();
		this.addTexture("snow", snow);
	}

	addTexture(name, texture) {
		this.textures.set(name, texture);
		this.textureList.push(name);
	}

	get(type) {
		return this.textures.get(type);
	}

	getTextureIndex(textureName) {
		return this.textureList.indexOf(textureName);
	}

	getTextureByIndex(index) {
		return this.textures.get(this.textureList[index]);
	}

	getTextureCount() {
		return this.textureList.length;
	}
}
const textureRegistry = new TextureRegistry(); // global