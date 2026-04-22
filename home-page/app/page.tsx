'use client'

import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { createNoise2D } from 'simplex-noise'
import { OrbitControls } from '@react-three/drei'


// ================= CLOUDS =================

function Clouds() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const texture = useLoader(THREE.TextureLoader, '/textures/clouds.png')

  useEffect(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(6, 6)
  }, [texture])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    meshRef.current.position.x += delta * 0.3

    if (meshRef.current.position.x > 100) {
      meshRef.current.position.x = -100
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, 10, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[600, 600]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.5}
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
          color="#ffffff"
        />    </mesh>
  )
}


// ================= SCENE =================

function Scene({ gameState, setGameState, isNight }) {
  const { camera } = useThree()

  const { scene: world } = useGLTF('/models/world.glb')
  const raycaster = useRef(new THREE.Raycaster())
  const [isHovering, setIsHovering] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const INTERACTION_DELAY = 500
  const tableRef = useRef<THREE.Mesh>(null!)
  const [topTex, sideTex, frontTex] = useLoader(THREE.TextureLoader, [
    '/textures/crafting_top.png',
    '/textures/crafting_side.png',
    '/textures/crafting_front.png'
  ])

    useEffect(() => {
      ;[topTex, sideTex, frontTex].forEach(tex => {
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter
        tex.generateMipmaps = false
        tex.anisotropy = 1
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
      })
    }, [topTex, sideTex, frontTex])
  
  // 🔊 CLICK SOUND
    const clickSound = useRef<HTMLAudioElement | null>(null)
    
    useEffect(() => {
      clickSound.current = new Audio('/sounds/click.mp3')
      clickSound.current.volume = 0.35
    }, [])

    const playClick = () => {
      if (!clickSound.current) return

      clickSound.current.currentTime = 0
      clickSound.current.playbackRate = 0.95 + Math.random() * 0.1
      clickSound.current.play().catch(() => {})
    }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  

  useFrame(() => {
    if (!tableRef.current) return

    raycaster.current.setFromCamera(mouse, camera)
    const intersects = raycaster.current.intersectObject(tableRef.current)

    setIsHovering(intersects.length > 0)
  })

  useEffect(() => {
    const handleRightClick = (e) => {
      if (isHovering && gameState === 'idle') {
        e.preventDefault()
        
        playClick()
        setGameState('interacting')

        setTimeout(() => {
          setGameState('menu')
        }, INTERACTION_DELAY)
      } else {
        e.preventDefault() // 🔥 block everywhere else
      }
    }

    window.addEventListener('contextmenu', handleRightClick)
    return () => window.removeEventListener('contextmenu', handleRightClick)
  }, [isHovering, gameState, setGameState])

  // 🔥 CAMERA FIX (cinematic angle like reference)
  useEffect(() => {
    camera.position.set(27.22, 0.72, -20.90)
    camera.lookAt(17.34, -0.78, -20.57)
  }, [camera])

  return (
    <>
      <mesh ref={tableRef} position={[25.7, 0.5, -20.85]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />

        {/* RIGHT (+X) → east → side */}
        <meshStandardMaterial attach="material-0" map={sideTex} />

        {/* LEFT (-X) → west → front */}
        <meshStandardMaterial attach="material-1" map={frontTex} />

        {/* TOP (+Y) → up */}
        <meshStandardMaterial attach="material-2" map={topTex} />

        {/* BOTTOM (-Y) → ignored → use side */}
        <meshStandardMaterial attach="material-3" map={sideTex} />

        {/* FRONT (+Z) → south → side */}
        <meshStandardMaterial attach="material-4" map={sideTex} />

        {/* BACK (-Z) → north → front */}
        <meshStandardMaterial attach="material-5" map={frontTex} />
      </mesh>

      <Clouds />

      {/* 🔥 FOREGROUND MODEL (UNCHANGED) */}
      <group
        position={[0, -6, -20]}
        rotation={[0, 4, 0]}   // 🔥 apply rotation at group level
        scale={2}
      >
        <primitive object={world} />
      </group>
    </>
  )
}


// ================= UI =================

function CraftingUI({ onClose }) {
  const BARRIER = "/icons/barrier.png"

  const [hoveredItem, setHoveredItem] = useState<any>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const hoverSound = useRef<HTMLAudioElement | null>(null)
  const clickSound = useRef<HTMLAudioElement | null>(null)

  // 🔊 PLAY CLICK (reusable)
  const playClick = () => {
    if (clickSound.current) {
      clickSound.current.currentTime = 0
      clickSound.current.playbackRate = 0.95 + Math.random() * 0.1
      clickSound.current.play().catch(() => {})
    }
  }

  // 🔊 PLAY HOVER (NEW - cleaner reuse)
  const playHover = () => {
    if (hoverSound.current) {
      hoverSound.current.currentTime = 0
      hoverSound.current.playbackRate = 0.95 + Math.random() * 0.1
      hoverSound.current.play().catch(() => {})
    }
  }

  // ✅ SAFE AUDIO INIT
  useEffect(() => {
    try {
      hoverSound.current = new Audio('/sounds/hover.mp3')
      clickSound.current = new Audio('/sounds/click.mp3')

      hoverSound.current.volume = 0.25
      clickSound.current.volume = 0.35
    } catch (e) {
      console.warn("Audio failed to initialize", e)
    }
  }, [])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMove)
    return () => window.removeEventListener("mousemove", handleMove)
  }, [])

  // ✅ ESC now plays click sound
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playClick()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const startX = 16.5
  const startY = 10
  const gapX = 10.5
  const gapY = 10.9

  const slots = [
    { name: "About Me", icon: "/icons/about.png", x: 0, y: 0, rarity: "unlocked" },
    { name: "Projects", icon: "/icons/projects.png", x: 1, y: 0, rarity: "unlocked" },
    { name: "Experience", icon: "/icons/experience.png", x: 2, y: 0, rarity: "unlocked" },

    { name: "Locked", icon: BARRIER, x: 0, y: 1, rarity: "locked" },
    { name: "Locked", icon: BARRIER, x: 1, y: 1, rarity: "locked" },
    { name: "Locked", icon: BARRIER, x: 2, y: 1, rarity: "locked" },

    { name: "Locked", icon: BARRIER, x: 0, y: 2, rarity: "locked" },
    { name: "Locked", icon: BARRIER, x: 1, y: 2, rarity: "locked" },
    { name: "Resume", icon: "/icons/resume.png", x: 2, y: 2, rarity: "legendary" },
  ]

  const rarityColors = {
    common: "#ffffff",
    unlocked: "#55FFFF",
    legendary: "#FFAA00",
    locked: "#AAAAAA"
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-crosshair z-[999]">

      <div className="relative minecraft-font" style={{
        width: "min(83vw, 465px)",
        aspectRatio: "352 / 332",
        backgroundImage: "url('/textures/crafting.webp')",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated"
      }}>

        {/* CLOSE BUTTON */}
        <button
          onClick={() => {
            playClick()
            onClose()
          }}
          style={{
            position: "absolute",
            top: "5%",
            right: "4%",
            fontSize: "18px",
            fontWeight: "bold",
            color: "black",
            cursor: "pointer",
            lineHeight: 1
          }}
        >
          X
        </button>

        {slots.map((slot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${startY + slot.y * gapY}%`,
              left: `${startX + slot.x * gapX}%`,
              width: "9.8%",
              height: "9.8%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: slot.icon !== BARRIER ? "pointer" : "default",
              opacity: slot.icon === BARRIER ? 0.6 : 1
            }}
            className="hover:bg-white/10"

            onMouseEnter={() => {
              setHoveredItem(slot)
              playHover() // 🔥 cleaner
            }}

            onMouseLeave={() => setHoveredItem(null)}

            onClick={() => {
              playClick()

              if (slot.icon === "/icons/resume.png") {
                window.open('/resume.pdf', '_blank')
              }
            }}
          >
            <img
              src={slot.icon}
              alt={slot.name}
              style={{
                width: "90%",
                height: "90%",
                imageRendering: "pixelated"
              }}
            />
          </div>
        ))}

        <div style={{
          position: "absolute",
          top: "21%",
          left: "69.8%",
          width: "10%",
          height: "10%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.6
        }}>
          <img
            src={BARRIER}
            alt="locked"
            style={{
              width: "90%",
              height: "90%",
              imageRendering: "pixelated"
            }}
          />
        </div>

      </div>

      {/* TOOLTIP */}
      {hoveredItem && (
        <div className="force-mojangles" style={{
          position: "fixed",
          top: mousePos.y + 12,
          left: mousePos.x + 12,
          pointerEvents: "none",
          zIndex: 999,
          fontFamily: "'Mojangles'",
          fontSize: "22px",
          lineHeight: "1",
          color: rarityColors[hoveredItem.rarity],
          padding: "5px 6px 2px 6px",
          whiteSpace: "nowrap",
          backgroundColor: "#100010",
          borderRadius: "3px",
          boxShadow: `
            0 0 0 1px #000,
            inset 0 0 0 1px #2a004f,
            inset 1px 1px 0 #3f0f7f,
            inset -1px -1px 0 #000,
            inset 1px 0 0 #3f0f7f,
            inset 0 1px 0 #3f0f7f,
            inset -1px 0 0 #000,
            inset 0 -1px 0 #000
          `,
          textShadow: "1px 1px #000",
          imageRendering: "pixelated"
        }}>
          {hoveredItem.name}
        </div>
      )}

    </div>
  )
}

// ================= MAIN =================

const SPLASH_TEXTS = [
  "Curious since spawn!",
  "Achievement get: Overthinker!",
  "Always in learning mode!",
  "Thrives in multiplayer!",
  "+10 teamwork bonus!",
  "Intrusion detected. Investigating…",
  "Now with Leadership skills!",
  "Main quest: impact!",
  "Sleeps? Optional.",
  "Packet loss? Negative.",
  "Pre-final year, final boss pending!",
  "Built under pressure!",
  "Latency kept low!",
  "Rollback ready!",
  "System health: green!",
  "Learning curve accepted!",
  "Upgrading skill tree!",
  "Logs don’t lie!",
  "Edge cases included!",
  "Clean code (mostly)!",
  "Next version loading…"
];

export default function Home() {
  const [gameState, setGameState] = useState('idle')
  const [splash, setSplash] = useState("")
  const [angle, setAngle] = useState(-20)
  const [scale, setScale] = useState(1)
  const splashRef = useRef<HTMLDivElement>(null!)
  const [chatStep, setChatStep] = useState(0)
  const splashPoolRef = useRef<string[]>([])
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [isNight, setIsNight] = useState(false)


  useEffect(() => {
    const first = setTimeout(() => {
      setChatStep(1)
    }, 5000)

    const second = setTimeout(() => {
      setChatStep(2)
    }, 8000) // 5s + 3s

    return () => {
      clearTimeout(first)
      clearTimeout(second)
    }
  }, [])


  useEffect(() => {
    if (splashPoolRef.current.length === 0) {
      const arr = [...SPLASH_TEXTS]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      splashPoolRef.current = arr
    }

    const next = splashPoolRef.current.pop()
    const randomAngle = -10 + Math.random() * 4

    setSplash(next)
    setAngle(randomAngle)
  }, [])

  useEffect(() => {
    if (!splashRef.current) return

    const el = splashRef.current
    const maxWidth = 260
    const actualWidth = el.scrollWidth

    if (actualWidth > maxWidth) {
      setScale(maxWidth / actualWidth)
    } else {
      setScale(1)
    }
  }, [splash])

  return (
    <div className="w-screen h-screen relative"
    style={{ backgroundColor: isNight ? "#05080e" : "#87CEEB" }}
    >

      {/* TITLE + SPLASH */}
      <div className="absolute top-6 w-full flex justify-center pointer-events-none select-none z-[100]">
        <div className="relative inline-block">

          <div className="flex flex-col items-center">
            <h1 className="minecraft-logo">
              MAYUKH TILAK
            </h1>

            <div className="minecraft-edition mt-2">
              Works on My Machine Edition
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              top: "80%",
              left: "92%",
              transform: `
                translate(-50%, -50%)
                rotate(${angle}deg)
              `
            }}
          >
            <div
              style={{
                width: "260px",
                transform: `scale(${scale})`,
                transformOrigin: "center"
              }}
            >
              <div
                ref={splashRef}
                className="minecraft-splash whitespace-nowrap text-center"
              >
                {splash}
              </div>
            </div>
          </div>

        </div>
      </div>


      <div
        onClick={() => setIsNight(prev => !prev)}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 300,
          width: "40px",
          height: "40px",
          cursor: "pointer",
          imageRendering: "pixelated"
        }}
      >
        <img
          src="/icons/day_night.png"
          alt="toggle"
          style={{ width: "100%", height: "100%" }}
        />
      </div>


      {/* SCENE */}
      <Canvas camera={{ position: [0, 2, 5], fov: 60 }}>
        <ambientLight intensity={isNight ? 0.2 : 0.5} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={isNight ? 0.3 : 0.8}
        />
        <Scene
          gameState={gameState}
          setGameState={setGameState}
          isNight={isNight}
        />
        <color attach="background" args={[isNight ? '#05080e' : '#87CEEB']} />
        <fog attach="fog" args={[isNight ? '#05080e' : '#87CEEB', 30, 140]} />
        </Canvas>

      {/* UI */}
      
      {chatStep > 0 && (
        <div
          className="force-mojangles"
          style={{
            position: "absolute",
            bottom: "100px",
            left: "30px",
            zIndex: 200,
            fontSize: "20px",
            lineHeight: "1.4",
            padding: "8px 10px",
            backgroundColor: "rgba(0,0,0,0.5)", // 🔥 translucent box
            borderRadius: "2px",
            minWidth: "420px", // keeps box stable
            imageRendering: "pixelated"
          }}
        >
          {/* MESSAGE 1 */}
          {chatStep >= 1 && (
            <div style={{ color: "#FFFFFF", textShadow: "2px 2px #000" }}>
              <span style={{ color: "#AAAAAA" }}>&lt;Mayukh-Tilak&gt;</span>{" "}
              <span style={{ color: "#FFAA00" }}>Welcome!</span>
            </div>
          )}

          {/* MESSAGE 2 */}
          {chatStep >= 2 && (
            <div style={{ color: "#FFFFFF", textShadow: "2px 2px #000" }}>
              <span style={{ color: "#AAAAAA" }}>&lt;Mayukh-Tilak&gt;</span>{" "}
              Please{" "}
              <span style={{ color: "#FFAA00" }}>right-click</span>{" "}
              on the{" "}
              <span style={{ color: "#FFAA00" }}>crafting table</span>{" "}
              to navigate.
            </div>
          )}
        </div>
      )}

      {gameState === 'menu' && (
        <CraftingUI onClose={() => setGameState('idle')} />
      )}
    </div>
  )
}