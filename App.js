import React, { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions, View, Button, Image, Alert, StyleSheet } from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import { DeviceMotion} from 'expo-sensors'
import { Audio} from 'expo-av'
import * as ImagePicker from 'expo-image-picker';
import * as Camera from 'expo-camera';
import {database} from './firebase'
import { collection, addDoc} from 'firebase/firestore'

function GameComponent() {

  const { width, height } = Dimensions.get('window');

  const [isAvailable, setIsAvailable] = useState(false)
  const [motionData, setMotionData] = useState(null)
  const [running, setRunning] = useState(true)
  
  const [sound, setSound] = useState(null)
  const [image, setImage] = useState(null);
  const insets = useSafeAreaInsets();

  async function addDocument(){
    await addDoc(collection(database, "notes"), {
      text: "sending a heartfelt greeting"
    })
    //setText("") // clear the input field
  }

  async function handleCameraButtonPress() {
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    const cameraRollPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPermission.status === 'granted' && cameraRollPermission.status === 'granted') {
      let result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        // Access the first item in the assets array
        setImage(result.assets[0].uri);
      }
    } else {
      Alert.alert('Permissions required', 'Camera and Photo permissions are needed to take pictures');
    }
  }



const ball = {
position: {
x: width / 2 - 25,
y: height / 2 - 25,
},
size: 50,
velocity: {
x: 0.2,
y: 0.2,
},
renderer: (props) => {
  const { position, size } = props;
  return (
  <View
    style={{
    backgroundColor: 'red',
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: size,
    height: size,
    borderRadius: size / 2,
    }}
  ></View>
  );
  },
}

const bat = {
  position: {
  x: width / 2,
  y: height,
  },
  size: 100,
  renderer: (props) => {
    const { position, size } = props;
    return (
      <View
        style={{
        backgroundColor: 'green',
        position: 'absolute',
        left: position.x,
        top: height - 20,
        width: size,
        height: size / 5,
        borderRadius: size / 2,
        }}
      />
    );
    },
  };

useEffect(()=>{
  async function subscribe(){
    const available = await DeviceMotion.isAvailableAsync()
    setIsAvailable(available) // tager tid at sætte denne ! den er async
    if(available){
      DeviceMotion.setUpdateInterval(20) // 20 millisekund pause imellem hver update
      DeviceMotion.addListener(deviceMotionData =>{
        setMotionData(deviceMotionData)
        //console.log("device: ", deviceMotionData.rotation.beta)
      })
    } else {console.log("ikke tilladelse til motion")}
  }
  subscribe()
  return () =>{
    DeviceMotion.removeAllListeners()
  }
},[]) // skal kun køre én gang, derfor []

useEffect(()=>{
  return sound ? ()=>{ sound.unloadAsync()} : undefined
},[sound])

const update = (entities, { time }) => {
  const ballEntity = entities.ball
  const batEntity = entities.bat

  let extra = 0
  if(motionData){
    extra = 5.0 * motionData.rotation.beta / 1.5
  }
  if(isNaN(extra)){ extra = 0.0}

  ballEntity.position.x += ballEntity.velocity.x * time.delta * (1 + extra)
  ballEntity.position.y += ballEntity.velocity.y * time.delta * (1 + extra)


  if (ballEntity.position.x < 0) { // venstre side
        ballEntity.velocity.x = Math.abs(ballEntity.velocity.x);
  }
  if (ballEntity.position.x + ballEntity.size > width ) { // højre side
    ballEntity.velocity.x = -1 * Math.abs(ballEntity.velocity.x)
  }
  if (ballEntity.position.y < 0) { // top
      ballEntity.velocity.y = Math.abs(ballEntity.velocity.y)
  }
  if (ballEntity.position.y + ballEntity.size > height - batEntity.size/5 ) { // bund
    if(ballEntity.position.x > batEntity.position.x
      && ballEntity.position.x < batEntity.position.x + batEntity.size){
      ballEntity.velocity.y = -1 * Math.abs(ballEntity.velocity.y)
    }else { // game over
      startRecording()
      setRunning(false)
    }
  }
  let newPos = 100
  if(isAvailable && motionData){
    newPos = 250 * motionData.rotation.gamma + 150 // gamma: -1 til +1
  }
  if(!isNaN(newPos)){ // kun hvis newPos ER et tal, gå videre
    batEntity.position.x = newPos
  }
  return entities;
};

async function startRecording(){
  try {
      const permission = await Audio.requestPermissionsAsync()
      if(permission.status ==='granted'){
        await Audio.setAudioModeAsync({
          allowsRecordingIOS:true,
          playsInSilentModeIOS:true
        })
        const newRecording = new Audio.Recording() // er new nødvendig?
        await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY)
        await newRecording.startAsync()

        setTimeout(async () => {
          if(newRecording){
            await newRecording.stopAndUnloadAsync()
            await Audio.setAudioModeAsync({
              allowsRecordingIOS:false,
              playsInSilentModeIOS:true
            })
            const uri = newRecording.getURI()
            playSound(uri)
          }
        }, 2000);

      }else {
        console.log("L155 ikke tilladelse")

      }
  } catch (error) {
    console.log("L159", error)
  }
}

async function playSound(uri){
  const { sound } = await Audio.Sound.createAsync(
      {uri},
      {shouldPlay:true}
  )
  setSound(sound)
}

function playAgain(){
  setRunning(true)
}

return (
    <View style={[{flex:1}, { paddingBottom: insets.bottom }]}>
    <View style={styles.cameraButton}>
          <Button title="Camera" onPress={handleCameraButtonPress} />
          <Button title="Send gr" onPress={addDocument} />
        </View>
        {image && (
            <Image source={{ uri: image }} style={styles.imagePreview} />
          )}
      <GameEngine
        running={running}
        key={running ? "game running": "game stopped"}
        systems={[update]}
        entities={{ ball,bat }}
        style={{ flex: 1, backgroundColor: 'white' }}
      />
      { !running && 
        <Button title='Play again' onPress={playAgain} />
      }
    </View>

)
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameComponent />
    </SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraButton: {
    position: 'absolute',
    top: 23,
    left: 10,
    zIndex: 1, // Ensures the button is above all other content
  },
  imagePreview: {
    position: 'absolute',
    top: 23,
    left: 90, // Adjust based on your needs
    width: 50,
    height: 40,
    zIndex: 1,
  },
  gameEngine: {
    flex: 1,
  },
});