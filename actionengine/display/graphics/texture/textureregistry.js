class TextureRegistry {	// Helper method to mark the texture manager's material properties as dirty
	_markMaterialPropertiesDirty() {
		// Find the game instance to access the renderer
		if (typeof Game !== 'undefined' && 
			Game.instance && 
			Game.instance.renderer3D && 
			Game.instance.renderer3D.textureManager) {
			// Mark the texture manager's material properties as dirty
			Game.instance.renderer3D.textureManager.materialPropertiesDirty = true;
		}
	}

	constructor() {
		this.textures = new Map();
		this.textureList = []; // Array to maintain texture order

		// Add material properties storage for each texture
		this.materialProperties = new Map();

		// Default material properties (used when not specified for a texture)
		this.defaultMaterialProperties = {
			roughness: 0.2,
			metallic: 0.1,
			baseReflectivity: 0.5
		};

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

		this.setMaterialProperties("grass", { roughness: 0.6, metallic: 0.0, baseReflectivity: 0.3 });
		this.setMaterialProperties("water", { roughness: 0.05, metallic: 0.0, baseReflectivity: 0.8 });
		this.setMaterialProperties("deepwater", { roughness: 0.05, metallic: 0.0, baseReflectivity: 0.8 });
		this.setMaterialProperties("sand", { roughness: 0.8, metallic: 0.0, baseReflectivity: 0.2 });
		this.setMaterialProperties("dunes", { roughness: 0.75, metallic: 0.0, baseReflectivity: 0.25 });
		this.setMaterialProperties("rock", { roughness: 0.7, metallic: 0.05, baseReflectivity: 0.3 });
		this.setMaterialProperties("highland", { roughness: 0.65, metallic: 0.0, baseReflectivity: 0.3 });
		this.setMaterialProperties("treeline", { roughness: 0.7, metallic: 0.0, baseReflectivity: 0.2 });
		this.setMaterialProperties("snow", { roughness: 0.4, metallic: 0.0, baseReflectivity: 0.7 });
	}

	addTexture(name, texture) {
		this.textures.set(name, texture);
		this.textureList.push(name);

		// Initialize material properties with defaults
		if (!this.materialProperties.has(name)) {
			this.materialProperties.set(name, { ...this.defaultMaterialProperties });
		}
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

	// Get material properties for a texture
	getMaterialProperties(textureName) {
		if (this.materialProperties.has(textureName)) {
			return this.materialProperties.get(textureName);
		}
		return { ...this.defaultMaterialProperties };
	}

	// Get material properties by texture index
	getMaterialPropertiesByIndex(index) {
		if (index >= 0 && index < this.textureList.length) {
			const textureName = this.textureList[index];
			return this.getMaterialProperties(textureName);
		}
		return { ...this.defaultMaterialProperties };
	}

	// Set material properties for a texture
	setMaterialProperties(textureName, properties) {
		if (!this.textures.has(textureName)) {
			console.warn(`Texture '${textureName}' does not exist.`);
			return;
		}

		// Get existing properties or default ones
		const existing = this.materialProperties.get(textureName) || { ...this.defaultMaterialProperties };
		
		// Check if any property is actually changing
		let hasChanges = false;
		Object.keys(properties).forEach(key => {
			if (properties[key] !== existing[key]) {
				hasChanges = true;
			}
		});
		
		// If nothing is changing, don't update
		if (!hasChanges) {
			return;
		}

		// Update with new properties
		this.materialProperties.set(textureName, {
			...existing,
			...properties
		});
		
		// Mark the texture manager's material properties as dirty
		this._markMaterialPropertiesDirty();
	}

	// Update default material properties (global settings)
	setDefaultMaterialProperties(properties) {
		// Check if any property is actually changing
		let hasChanges = false;
		Object.keys(properties).forEach(key => {
			if (properties[key] !== this.defaultMaterialProperties[key]) {
				hasChanges = true;
			}
		});
		
		// If nothing is changing, don't update
		if (!hasChanges) {
			return;
		}
		
		this.defaultMaterialProperties = {
			...this.defaultMaterialProperties,
			...properties
		};
		
		// Mark the texture manager's material properties as dirty
		this._markMaterialPropertiesDirty();
	}

	// Get all material properties as a flat array for use in a texture
	getMaterialPropertiesArray() {
		const textureCount = this.textureList.length;
		const data = new Float32Array(textureCount * 4); // 4 components per texture (roughness, metallic, baseReflectivity, reserved)

		for (let i = 0; i < textureCount; i++) {
			const textureName = this.textureList[i];
			const props = this.getMaterialProperties(textureName);

			// Set values in the array
			data[i * 4] = props.roughness;
			data[i * 4 + 1] = props.metallic;
			data[i * 4 + 2] = props.baseReflectivity;
			data[i * 4 + 3] = 0; // Reserved for future use
		}

		return data;
	}
}
const textureRegistry = new TextureRegistry(); // global