import { ProceduralTexture } from './proceduraltexture.js';

class TextureRegistry {

	constructor() {
		this.textures = new Map();
		this.textureList = []; // Array to maintain texture order

		// Add material properties storage for each texture
		this.materialProperties = new Map();

		// Default material properties (used when not specified for a texture)
		// Note: Roughness is from 0.0 (mirror-like) to 1.0 (completely rough/diffuse)
		// The shader inverts roughness internally so 0 = reflective, 1 = diffuse
		this.defaultMaterialProperties = {
			roughness: 0.0,  // Lower values = more reflective
			metallic: 0.0,  // Higher values = more metallic
			baseReflectivity: 0.0  // Higher values = more reflective at glancing angles
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

		this.setMaterialProperties("grass", { roughness: 1.0, metallic: 0.0, baseReflectivity: 0.0 });
		this.setMaterialProperties("water", { roughness: 0.08, metallic: 0.0, baseReflectivity: 0.72 });
		this.setMaterialProperties("deepwater", { roughness: 0.05, metallic: 0.0, baseReflectivity: 0.8 });
		this.setMaterialProperties("sand", { roughness: 0.54, metallic: 0.0, baseReflectivity: 0.21 });
		this.setMaterialProperties("dunes", { roughness: 0.75, metallic: 0.2, baseReflectivity: 0.42 });
		this.setMaterialProperties("rock", { roughness: 0.9, metallic: 0.05, baseReflectivity: 0.3 });
		this.setMaterialProperties("highland", { roughness: 0.0, metallic: 0.0, baseReflectivity: 0.0 });
		this.setMaterialProperties("treeline", { roughness: 0.7, metallic: 0.0, baseReflectivity: 0.2 });
		this.setMaterialProperties("snow", { roughness: 0.65, metallic: 0.1, baseReflectivity: 0.09 });
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
		


		// Update with new properties
		this.materialProperties.set(textureName, {
			...existing,
			...properties
		});
		
		// Material properties have been updated
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
		
		// Material properties have been updated
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